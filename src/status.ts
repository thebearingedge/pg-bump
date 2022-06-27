import { bootstrap, BootstrapResults, BootstrapOptions } from './lib'

type StatusOptions = BootstrapOptions & {

}

type StatusResults = Pick<BootstrapResults, 'applied' | 'pending' | 'missing' | 'untracked'>

export default async function status(options: StatusOptions): Promise<StatusResults> {
  const results = await bootstrap(options)
  return results
}
