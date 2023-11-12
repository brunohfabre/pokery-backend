import fastify from 'fastify'
import { ZodError } from 'zod'

import fastifyCors from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'

import { env } from './env'
import { InvalidCredentialsError } from './errors/invalid-credentials'
import { ResourceAlreadyExistsError } from './errors/resource-already-exists'
import { ResourceNotFound } from './errors/resource-not-found'
import { Unauthorized } from './errors/unauthorized'
import { UserAlreadyExistsError } from './errors/user-already-exists'
import { appRoutes } from './routes'

const app = fastify()

app.register(fastifyCors)
app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
})

app.register(appRoutes)

app.setErrorHandler((error, _, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: 'Validation error.',
      issues: error.errors,
    })
  }

  if (error instanceof Unauthorized) {
    return reply.status(401).send({
      message: error.message,
    })
  }

  if (error instanceof UserAlreadyExistsError) {
    return reply.status(409).send({
      message: error.message,
    })
  }

  if (error instanceof InvalidCredentialsError) {
    return reply.status(400).send({
      message: error.message,
    })
  }

  if (error instanceof ResourceNotFound) {
    return reply.status(400).send({
      message: error.message,
    })
  }

  if (error instanceof ResourceAlreadyExistsError) {
    return reply.status(400).send({
      message: error.message,
    })
  }

  if (env.NODE_ENV !== 'production') {
    console.error(error)
  } else {
    // TODO: Here we should log to external tool like DataDog/NewRelic/Sentry.
  }

  return reply.status(500).send({
    message: 'Internal server error.',
  })
})

app
  .listen({
    host: '0.0.0.0',
    port: 3333,
  })
  .then(() => console.log('Server running on port 3333!'))
