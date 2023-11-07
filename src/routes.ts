import { compare, hash } from 'bcryptjs'
import { FastifyInstance } from 'fastify'
import nodemailer from 'nodemailer'
import { z } from 'zod'

import { env } from './env'
import { InvalidCredentialsError } from './errors/invalid-credentials'
import { ResourceAlreadyExistsError } from './errors/resource-already-exists'
import { ResourceNotFound } from './errors/resource-not-found'
import { UserAlreadyExistsError } from './errors/user-already-exists'
import { prisma } from './lib/prisma'
import { verifyJwt } from './middlewares/verify-jwt'
import { generateVerificationCode } from './utils/generate-verification-code'

const mailConfig = {
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
} as object

const transporter = nodemailer.createTransport(mailConfig)

export async function appRoutes(app: FastifyInstance) {
  // Users
  app.post('/register', async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().min(1),
      email: z.string().min(1).email(),
    })
    const { name, email } = bodySchema.parse(request.body)

    const userWithSameEmail = await prisma.user.findUnique({
      where: {
        email,
      },
    })

    if (userWithSameEmail) {
      throw new UserAlreadyExistsError()
    }

    const verificationCode = generateVerificationCode()

    await prisma.user.create({
      data: {
        name,
        email,
        verificationCode,
      },
    })

    await transporter.sendMail({
      from: 'Pokery <noreply@pokery.com.br>',
      to: {
        name,
        address: email,
      },
      subject: 'Verification code',
      html: `Verification code: ${verificationCode}`,
    })

    return reply.status(204).send()
  })

  app.post('/verify-mail', async (request, reply) => {
    const bodySchema = z.object({
      email: z.string().min(1).email(),
      verificationCode: z.string().length(6),
    })
    const { email, verificationCode } = bodySchema.parse(request.body)

    const userExists = await prisma.user.findUnique({
      where: {
        email,
      },
    })

    if (!userExists) {
      throw new ResourceNotFound()
    }

    if (userExists.verificationCode !== verificationCode) {
      throw new ResourceNotFound()
    }

    await prisma.user.update({
      where: {
        id: userExists.id,
      },
      data: {
        verificationCode: null,
        emailVerifiedAt: new Date(),
      },
    })

    const token = await reply.jwtSign(
      {},
      {
        sign: {
          sub: userExists.id,
        },
      },
    )

    return reply.send({
      token,
    })
  })

  app.post('/resend-code', async (request, reply) => {
    const bodySchema = z.object({
      email: z.string().min(1).email(),
    })
    const { email } = bodySchema.parse(request.body)

    const userExists = await prisma.user.findUnique({
      where: {
        email,
      },
    })

    if (!userExists) {
      throw new ResourceNotFound()
    }

    const verificationCode = generateVerificationCode()

    const user = await prisma.user.update({
      where: {
        email,
      },
      data: {
        verificationCode,
      },
    })

    await transporter.sendMail({
      from: 'Pokery <noreply@pokery.com.br>',
      to: {
        name: user.name,
        address: email,
      },
      subject: 'Verification code',
      html: `Verification code: ${verificationCode}`,
    })

    return reply.status(204).send()
  })

  app.post('/password', { onRequest: [verifyJwt] }, async (request, reply) => {
    const bodySchema = z.object({
      password: z.string().min(6),
    })
    const { password } = bodySchema.parse(request.body)

    const userId = request.user.sub

    const passwordHash = await hash(password, 8)

    const findUser = await prisma.user.findFirst({
      where: {
        id: userId,
      },
    })

    if (findUser?.passwordHash) {
      throw new ResourceAlreadyExistsError()
    }

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash,
        lastLogin: new Date(),
      },
    })

    const token = await reply.jwtSign(
      {},
      {
        sign: {
          sub: userId,
        },
      },
    )

    return reply.send({
      token,
      user: {
        ...user,
        passwordHash: undefined,
      },
    })
  })

  // Sessions
  app.post('/sessions', async (request, reply) => {
    const bodySchema = z.object({
      email: z.string().min(1).email(),
      password: z.string().min(6),
    })
    const { email, password } = bodySchema.parse(request.body)

    const userExists = await prisma.user.findUnique({
      where: {
        email,
      },
    })

    if (!userExists) {
      throw new ResourceNotFound()
    }

    const doesPasswordMatches = await compare(
      password,
      userExists.passwordHash ?? '',
    )

    if (!doesPasswordMatches) {
      throw new InvalidCredentialsError()
    }

    const token = await reply.jwtSign(
      {},
      {
        sign: {
          sub: userExists.id,
        },
      },
    )

    return reply.send({
      token,
      user: {
        ...userExists,
        passwordHash: undefined,
      },
    })
  })
}
