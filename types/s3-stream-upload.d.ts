declare module "s3-stream-upload" {
  import { S3 } from "aws-sdk";
  interface UploadStreamOptions {
    Bucket: string;
    Key: string;
    ACL?: string;
  }
  export default function(s3: S3, options: UploadStreamOptions): WritableStream;
}
