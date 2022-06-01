import {ProjectGraph} from '@nrwl/workspace/src/core/project-graph';
import {NxJson} from '@nrwl/workspace/src/core/shared-interfaces';
import {
  defaultTasksRunner,
  DefaultTasksRunnerOptions,
  RemoteCache
} from '@nrwl/workspace/src/tasks-runner/default-tasks-runner';
import {AffectedEvent, Task, TasksRunner} from '@nrwl/workspace/src/tasks-runner/tasks-runner';
import {Observable} from 'rxjs';
import * as fs from 'fs';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import {S3Adapter, S3AdapterOptions} from "./s3-adapter";
import * as chalk from 'chalk';
class NXDistributedS3Cache implements RemoteCache {

  private readonly S3Adapter: S3Adapter;

  constructor(private remoteDirectory: string, options) {
    this.S3Adapter = new S3Adapter(options);
  }

  retrieve = async (hash: string, cacheDirectory: string): Promise<boolean> => {
    console.debug('NXDistributedCache::retrieve');

    const hashCommit = hash + '.commit';
    const local = path.join(cacheDirectory, hash);
    const remote = path.join(this.remoteDirectory, hash);
    const localCommit = path.join(cacheDirectory, hashCommit);
    const remoteCommit = path.join(this.remoteDirectory, hashCommit);


    if (!fs.existsSync(remote)) {
      console.log('No entry in local nx-cache not found. Checking remote...');
      let commitFile;
      try {
        commitFile = await this.S3Adapter.getFile(hashCommit);
      } catch (e) {
        console.log(chalk.yellow('Distributed cache: No entry found. Cache MISS!'));
        return Promise.resolve(false);
      }

      console.log(chalk.green('Entry in remote cache found. Downloading content...'));

      fs.mkdirSync(remote, {recursive: true})
      fs.writeFileSync(remoteCommit, commitFile.toString())

      await this.S3Adapter.downloadDirectory(hash, this.remoteDirectory);
      console.log('Download finished. Processing cached content...');
    }
    if (fs.existsSync(remote)) {
      console.debug(chalk.green.bold('NXDistributedCache::retrieve - cache HIT'));
      fsExtra.copySync(remote, local);
      fsExtra.copySync(remoteCommit, localCommit);
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }

  store = (hash: string, cacheDirectory: string): Promise<boolean> => {
    console.debug(chalk.blue('NXDistributedCache::store'));

    const hashCommit = hash + '.commit';
    const local = path.join(cacheDirectory, hash);
    const remote = path.join(this.remoteDirectory, hash);
    const localCommit = path.join(cacheDirectory, hashCommit);
    const remoteCommit = path.join(this.remoteDirectory, hashCommit);

    this.S3Adapter.uploadDir(local, hash);
    this.S3Adapter.uploadFile(localCommit, hashCommit);

    console.log(chalk.green(`${hash} successfully stored in distributed cache.`));

    fsExtra.copySync(local, remote);
    fsExtra.copySync(localCommit, remoteCommit);

    return Promise.resolve(true);
  }
}


export type CustomTasksRunnerOptions = DefaultTasksRunnerOptions & {
  remoteDirectory: string;
  distributedCacheOptions: S3AdapterOptions

}

export const customTasksRunner: TasksRunner<CustomTasksRunnerOptions> =
  (tasks: Task[], options: CustomTasksRunnerOptions, context?: {
    target?: string;
    initiatingProject?: string | null;
    projectGraph: ProjectGraph;
    nxJson: NxJson;
  }): Observable<AffectedEvent> => {

    console.log(chalk.blue.bold('Executing customTaskRunner: NXDistributedCache'));
    options.remoteCache = new NXDistributedS3Cache(options.remoteDirectory, options.distributedCacheOptions);
    return defaultTasksRunner(tasks, options, context);

  }

export default customTasksRunner;
