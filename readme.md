## NX-Distributed-Cache

A custom runner for builds in NX to store your build artifacts on a distributed storage.

This custom runner only supports AWS S3 storage for now. Other storages might be added in the future. Feel free to add one and
create a PR.

## Install

nx-distributed-cache is available on npm:

```sh
npm install @magile/nx-distributed-cache --save-dev
```

## Usage

Add or update your `taskRunnerOptions` in your `nx.json` to use this custom task runner:

```json
"tasksRunnerOptions": {
    "default": {
        "runner": "./node_modules/@magile/nx-distributed-cache/S3",
        "options": {
            "cacheableOperations": ["build", "lint", "test", "e2e"],
            "remoteDirectory": "<local cache directory>",
            "distributedCacheOptions": {
                "bucketName": "<name of your S3 bucket>",
                "accessKeyId": "<accessKeyId>",
                "secretAccessKey": "<secretAccessKey>"
            }
        }
    }
},
```

### AWS Policy
The user belonging to these credentials needs at least access to read, write and list items in the bucket.

Example AWS policy:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::<s3 bucket>/*",
                "arn:aws:s3:::<s3 bucket>"
            ]
        }
    ]
}
```
### Enviroment 
You can also set all these options as an environment variable in your build-process (e.g. docker ENV, ...):

```js
process.env.bucketName = 'your-s3-bucket-name';
process.env.accessKeyId = 'your-accessKeyId';
process.env.secretAccessKey = 'your-secretAccessKey';
```


