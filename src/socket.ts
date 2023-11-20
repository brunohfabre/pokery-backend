import { randomUUID } from 'crypto'
import { FastifyInstance } from 'fastify'
import _ from 'lodash'
import { Server } from 'socket.io'

import { prisma } from './lib/prisma'

export let io: Server

type MatchType = {
  id: string
  countdown: any
  players: { id: string; name: string; ready: boolean }[]
}

const players: Record<string, string> = {}
let matches: Record<string, MatchType> = {}

function verifyCountdown({ matchId }: { matchId: string }) {
  const findMatch = matches[matchId]

  if (!findMatch) {
    return
  }

  if (!findMatch.players.length) {
    matches = _.omit(matches, [matchId])

    return
  }

  const allPlayersReady = findMatch.players.every((player) => player.ready)

  if (allPlayersReady && findMatch.players.length > 1) {
    matches[matchId] = {
      ...findMatch,
      countdown: setTimeout(async () => {
        const match = await prisma.match.create({
          data: {
            players: {
              connect: findMatch.players.map((player) => ({
                id: player.id,
              })),
            },
            stages: {
              create: {
                type: 'START',
                data: {},
              },
            },
          },
        })

        matches = _.omit(matches, [matchId])

        io.emit(`match.${matchId}.start`, {
          matchId: match.id,
        })
      }, 10 * 1000),
    }

    io.emit(`match.${matchId}.countdown.start`)
  } else {
    if (!findMatch.countdown) {
      return
    }

    if (findMatch.countdown?._idleTimeout === -1) {
      return
    }

    clearTimeout(findMatch.countdown)

    io.emit(`match.${matchId}.countdown.stop`)
  }
}

export async function fastifySocketIO(app: FastifyInstance) {
  io = new Server(app.server)

  io.on('connection', (socket) => {
    socket.on('online', ({ userId }) => {
      players[socket.id] = userId
    })

    socket.on('disconnect', () => {
      const userId = players[socket.id]

      const findMatchId = Object.keys(matches).find((key) =>
        matches[key].players.some((player) => player.id === userId),
      )

      if (!findMatchId) {
        return
      }

      matches[findMatchId] = {
        ...matches[findMatchId],
        players: matches[findMatchId].players.filter(
          (player) => player.id !== userId,
        ),
      }

      io.emit(`match.${findMatchId}.player.exited`, {
        playerId: userId,
      })

      verifyCountdown({
        matchId: findMatchId,
      })
    })

    socket.on('find-match', ({ player }, cb: any) => {
      const findMatchId = Object.keys(matches).find(
        (key) => matches[key].players.length < 9,
      )

      if (findMatchId) {
        const matchUpdated = {
          ...matches[findMatchId],
          players: [
            ...matches[findMatchId].players,
            { ...player, ready: false },
          ],
        }

        matches[findMatchId] = matchUpdated

        io.emit(`match.${findMatchId}.player.joined`, {
          player: {
            ...player,
            ready: false,
          },
        })

        verifyCountdown({
          matchId: findMatchId,
        })

        cb({
          match: matchUpdated,
        })

        return
      }

      const matchId = randomUUID()

      const match = {
        id: matchId,
        countdown: null,
        players: [{ ...player, ready: false }],
      }

      matches[matchId] = match

      cb({
        match,
      })
    })

    socket.on('match.get', ({ matchId }, cb) => {
      const findMatch = matches[matchId]

      cb({ match: findMatch })
    })

    socket.on('match.exit', ({ playerId }) => {
      const findMatchId = Object.keys(matches).find((key) =>
        matches[key].players.some((player) => player.id === playerId),
      )

      if (!findMatchId) {
        return
      }

      matches[findMatchId] = {
        ...matches[findMatchId],
        players: matches[findMatchId].players.filter(
          (player) => player.id !== playerId,
        ),
      }

      io.emit(`match.${findMatchId}.player.exited`, {
        playerId,
      })

      verifyCountdown({
        matchId: findMatchId,
      })
    })

    socket.on('match.player.change-ready', ({ matchId, playerId }) => {
      const findMatch = matches[matchId]

      if (!findMatch) {
        return
      }

      const findPlayer = findMatch.players.find(
        (player) => player.id === playerId,
      )

      if (!findPlayer) {
        return
      }

      const newMatch = {
        ...findMatch,
        players: findMatch.players.map((player) =>
          player.id === playerId ? { ...player, ready: !player.ready } : player,
        ),
      }

      const newPlayerState = {
        ...findPlayer,
        ready: !findPlayer.ready,
      }

      matches[matchId] = newMatch

      io.emit(`match.${matchId}.player.changed`, {
        player: newPlayerState,
      })

      verifyCountdown({ matchId })
    })
  })
}
