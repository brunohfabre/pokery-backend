import { randomUUID } from 'crypto'
import { FastifyInstance } from 'fastify'
import { Server } from 'socket.io'

export let io: Server

type MatchType = {
  id: string
  players: { id: string; name: string }[]
}

const players: Record<string, string> = {}
let matches: MatchType[] = []

export async function fastifySocketIO(app: FastifyInstance) {
  io = new Server(app.server)

  io.on('connection', (socket) => {
    socket.on('online', ({ userId }) => {
      players[socket.id] = userId
    })

    socket.on('disconnect', () => {
      const userId = players[socket.id]

      const findMatch = matches.find((match) =>
        match.players.some((player) => player.id === userId),
      )

      if (findMatch) {
        matches = matches.map((match) =>
          match.players.some((player) => player.id === userId)
            ? {
                ...match,
                players: match.players.filter((player) => player.id !== userId),
              }
            : match,
        )

        io.emit(`match.${findMatch.id}.player.exited`, {
          playerId: userId,
        })
      }
    })

    socket.on('find-match', ({ player }, cb: any) => {
      const findMatch = matches.find((match) => match.players.length < 9)

      if (findMatch) {
        if (findMatch.players.some((item) => item.id === player.id)) {
          cb({
            match: findMatch,
          })

          return
        }

        const newMatch = {
          ...findMatch,
          players: [...findMatch.players, player],
        }

        matches = matches.map((match) =>
          match.id === findMatch.id ? newMatch : match,
        )

        io.emit(`match.${findMatch.id}.player.joined`, { player })

        cb({
          match: newMatch,
        })

        return
      }

      const matchId = randomUUID()

      const match = {
        id: matchId,
        players: [player],
      }

      matches.push(match)

      cb({
        match,
      })
    })

    socket.on('match.get', ({ matchId }, cb) => {
      const findMatch = matches.find((match) => match.id === matchId)

      cb({ match: findMatch })
    })

    socket.on('match.exit', ({ matchId, playerId }) => {
      const findMatch = matches.find((match) =>
        match.players.some((player) => player.id === playerId),
      )

      if (findMatch) {
        matches = matches.map((match) =>
          match.players.some((player) => player.id === playerId)
            ? {
                ...match,
                players: match.players.filter(
                  (player) => player.id !== playerId,
                ),
              }
            : match,
        )

        io.emit(`match.${findMatch.id}.player.exited`, {
          playerId,
        })
      }
    })
  })
}
