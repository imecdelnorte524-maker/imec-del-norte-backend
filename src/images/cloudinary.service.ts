import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

type CloudinaryResourceType = 'image' | 'raw' | 'video';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  upload(
    file: Express.Multer.File,
    folder: string,
    resourceType: CloudinaryResourceType = 'image',
  ) {
    return new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            resource_type: resourceType,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        )
        .end(file.buffer);
    });
  }

  delete(publicId: string, resourceType: CloudinaryResourceType = 'image') {
    return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  }
}