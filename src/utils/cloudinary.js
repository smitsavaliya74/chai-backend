import {v2 as cloudinary} from "cloudinary";
import fs from "fs"; // file system for open delete and for file related anything(handle file system)

 cloudinary.config({ 
        cloud_name:process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View API Keys' above to copy your API secret
    }); 


    const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // file has been uploaded successfull
        //console.log("file is uploaded on cloudinary ", response.url);
        fs.unlinkSync(localFilePath)
        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        return null;
    }
};

const deleteFromCloudinary = async (imageUrl) => {
    try {
        if (!imageUrl) return null;

        const urlParts = imageUrl.split("/");

        const fileName = urlParts[urlParts.length - 1];
        const folderName = urlParts[urlParts.length - 2];

        const publicId =
            `${folderName}/${fileName.split(".")[0]}`;

        return await cloudinary.uploader.destroy(publicId);

    } catch (error) {
        console.log("Cloudinary delete error:", error);
        return null;
    }
};



export {uploadOnCloudinary,deleteFromCloudinary}

