import chalk from 'chalk'
/* c8 ignore start */
type Logger = {
  prefix: () => Logger
  info: (...args: any[]) => void
  error: (...args: any[]) => void
}

type LoggerOptions = {
  silent?: boolean
}

const { log, error } = console

export default function createLogger({ silent = true }: LoggerOptions): Logger {
  return {
    prefix(): Logger {
      if (silent) return this
      process.stdout.write(chalk.red('[pg-bump]') + ' ')
      return this
    },
    info(...args: any[]): void {
      if (silent) return
      log(...args)
    },
    error(...args: any[]): void {
      if (silent) return
      error(...args)
    }
  }
}
