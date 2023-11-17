import { randomUUID } from 'crypto'
import { FastifyInstance } from 'fastify'
import { Server } from 'socket.io'

export let io: Server

type MatchType = {
  id: string
  players: { id: string; name: string; ready: boolean }[]
}

const players: Record<string, string> = {}
let matches: MatchType[] = []

let startMatchCountdown: any

function verifyCountdown({ matchId }: { matchId: string }) {
  const findMatch = matches.find((match) => match.id === matchId)

  if (!findMatch) {
    return
  }

  const allPlayersReady = findMatch.players.every((player) => player.ready)

  if (
    findMatch.players.length > 1 &&
    allPlayersReady &&
    (!startMatchCountdown || startMatchCountdown?._idleTimeout === -1)
  ) {
    io.emit(`match.${matchId}.countdown.start`)

    startMatchCountdown = setTimeout(() => {
      io.emit(`match.${matchId}.start`)
    }, 10 * 1000)
  } else {
    if (!!startMatchCountdown && startMatchCountdown?._idleTimeout !== -1) {
      io.emit(`match.${matchId}.countdown.stop`)

      clearTimeout(startMatchCountdown)
    }
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

      const findMatch = matches.find((match) =>
        match.players.some((player) => player.id === userId),
      )

      if (!findMatch) {
        return
      }

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

      verifyCountdown({
        matchId: findMatch.id,
      })
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
          players: [...findMatch.players, { ...player, ready: false }],
        }

        matches = matches.map((match) =>
          match.id === findMatch.id ? newMatch : match,
        )

        io.emit(`match.${findMatch.id}.player.joined`, {
          player: {
            ...player,
            ready: false,
          },
        })

        verifyCountdown({
          matchId: newMatch.id,
        })

        cb({
          match: newMatch,
        })

        return
      }

      const matchId = randomUUID()

      const match = {
        id: matchId,
        players: [{ ...player, ready: false }],
      }

      matches.push(match)

      verifyCountdown({
        matchId: match.id,
      })

      cb({
        match,
      })
    })

    socket.on('match.get', ({ matchId }, cb) => {
      const findMatch = matches.find((match) => match.id === matchId)

      cb({ match: findMatch })
    })

    socket.on('match.exit', ({ playerId }) => {
      const findMatch = matches.find((match) =>
        match.players.some((player) => player.id === playerId),
      )

      if (!findMatch) {
        return
      }

      matches = matches.map((match) =>
        match.players.some((player) => player.id === playerId)
          ? {
              ...match,
              players: match.players.filter((player) => player.id !== playerId),
            }
          : match,
      )

      io.emit(`match.${findMatch.id}.player.exited`, {
        playerId,
      })

      verifyCountdown({
        matchId: findMatch.id,
      })
    })

    socket.on('match.player.change-ready', ({ matchId, playerId }) => {
      const findMatch = matches.find((match) => match.id === matchId)

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

      matches = matches.map((match) => (match.id ? newMatch : match))

      io.emit(`match.${matchId}.player.changed`, {
        player: newPlayerState,
      })

      verifyCountdown({ matchId })
    })
  })
}
