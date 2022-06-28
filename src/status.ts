import bootstrap, { BootstrapResults, BootstrapOptions } from './bootstrap'

export type StatusOptions = BootstrapOptions & {

}

export type StatusResults = BootstrapResults

export default async function status(options: StatusOptions): Promise<StatusResults> {
  const results = await bootstrap(options)
  return results
}
