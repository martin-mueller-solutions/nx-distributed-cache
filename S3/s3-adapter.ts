import {S3} from "aws-sdk";
const AWS = require('aws-sdk');
const path = require("path");
const fs = require('fs');

export interface S3AdapterOptions {
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string
}

export class S3Adapter {
  options: S3AdapterOptions;
  S3: S3;

  constructor(options: S3AdapterOptions) {
    this.options = Object.assign(options, process.env);

    if (!this.options.accessKeyId || !this.options.secretAccessKey || !this.options.bucketName) {
      throw Error('The configuration for S3 is invalid');
    }

    this.S3 = new AWS.S3({
      accessKeyId: this.options.accessKeyId,
      secretAccessKey: this.options.secretAccessKey
    })
  }

  uploadFile(fileName, targetPath) {
    fs.readFile(fileName, (err, data) => {
      if (err) {
        throw err;
      }
      const params = {
        Bucket: this.options.bucketName,
        Key: targetPath,
        Body: data
      };
      this.S3.upload(params, function (s3Err, data) {
        if (s3Err) {
          throw s3Err
        }
      });
    });
  };

  getFile(directory) {
    return new Promise<any>(async (resolve, reject) => {
      this.S3.getObject({
        Bucket: this.options.bucketName,
        Key: directory
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        resolve(data.Body);
      });
    });
  }

  async fileExists(fileName) {
    const files = await this.listFiles(fileName);

    return files.length > 0;
  }


  async listFiles(directory): Promise<{ size: number, key: string }[]> {
    return new Promise<any>(async (resolve, reject) => {
      this.S3.listObjectsV2({
        Bucket: this.options.bucketName,
        Prefix: directory + '/'
      }, (err, data) => {
        if (err) {
          console.error('Unable to fetch from AWS S3.listObjectsV2.', err);
          return reject(null);
        }
        resolve(data.Contents.map(e => ({key: e.Key, size: e.Size})));

      });
    });
  }

  async downloadDirectory(s3path, localPath) {

    const files = await this.listFiles(s3path);
    let size = 0;
    for (const file of files) {
      size += file.size;
    }

    console.log(`Downloading ${files.length} files (${(size / 1024).toFixed(1)}kb) from distributed cache...`);

    for (const file of files) {
      const content = await this.getFile(file.key);
      let writeFile = localPath + '/' + file.key;
      const writePath = writeFile.substring(0, writeFile.lastIndexOf('/'));

      try {
        fs.mkdirSync(writePath, {recursive: true})
        fs.writeFileSync(writeFile, content.toString())
      } catch (e) {
        console.log(e)
      }
    }
  }

  uploadDir(s3Path, hash) {

    const start = Date.now();
    let fileCount = 0;
    const walkSync = (currentDirPath, callback) => {
      fs.readdirSync(currentDirPath).forEach(name => {
        const filePath = path.join(currentDirPath, name);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          callback(filePath, stat);
        } else if (stat.isDirectory()) {
          walkSync(filePath, callback);
        }
      });
    };

    walkSync(s3Path, (filePath, stat) => {
      let bucketPath = filePath.substring(s3Path.length + 1);
      let params = {Bucket: this.options.bucketName + '/' +  hash, Key: bucketPath, Body: fs.readFileSync(filePath)};
      this.S3.putObject(params, (err, data) => {
        if (err) {
          console.log(err)
        }
        fileCount++;
      });
    });

    console.log(`Uploaded to distributed cache. This took ${Date.now() - start}ms`)
  };
}
