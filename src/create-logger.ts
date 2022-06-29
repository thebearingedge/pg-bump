import chalk from 'chalk'
/* c8 ignore start */
type Logger = {
  info: (...args: any[]) => void
  error: (...args: any[]) => void
}

type LoggerOptions = {
  silent: boolean
}

const { log, error } = console

export default function createLogger({ silent }: LoggerOptions): Logger {
  return {
    info(...args: any[]): void {
      if (silent) return
      process.stdout.write(chalk.red('[pg-bump]') + ' ') && log(...args)
    },
    error(...args: any[]): void {
      if (silent) return
      process.stdout.write(chalk.red('[pg-bump]') + ' ') && error(...args)
    }
  }
}
