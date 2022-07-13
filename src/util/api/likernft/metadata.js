import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { API_EXTERNAL_HOSTNAME } from '../../../constant';

async function addTextOnImage(text, color) {
  const width = 512;
  const height = 512;
  const svgImage = `
    <svg width="${width}" height="${height}">
      <style>
      .title { fill: ${color}; font-size: 100px; font-weight: bold;}
      </style>
      <text x="50%" y="50%" text-anchor="middle" class="title">${text}</text>
    </svg>
    `;
  const svgBuffer = Buffer.from(svgImage);
  const a = await sharp(svgBuffer)
    .png();
  return a;
}

async function getImageMask() {
  const imgPath = path.join(__dirname, '../../../assets/iscn.png');
  const maskData = await sharp(imgPath)
    .resize({
      width: 512,
      height: 512,
    })
    .toBuffer();
  return maskData;
}

let mask;
export async function getMaskedNFTImage() {
  mask = await getImageMask();
  const combinedData = await sharp()
    .resize({
      fit: sharp.fit.contain,
      width: 512,
      height: 512,
      background: 'white', // image white borders
    })
    .ensureAlpha()
    .composite([{ input: mask }])
    .png();
  return combinedData;
}

export async function getImageStream(image, title, color) {
  const randomHex = Math.floor(Math.random() * 16777215).toString(16);
  const ogImageUrl = `https://singlecolorimage.com/get/${randomHex}/512x512`;
  let imageStream;
  if (image) {
    imageStream = (await axios({ method: 'get', url: image, responseType: 'stream' })).data;
  } else if (title) {
    imageStream = await addTextOnImage(title, color);
  } else {
    imageStream = (await axios({ method: 'get', url: ogImageUrl, responseType: 'stream' })).data;
  }
  return imageStream;
}

export async function getDynamicBackgroundColor(soldCount) {
  // TODO: replace with actual color map
  if (soldCount > 100) {
    return '#28646e';
  } if (soldCount > 10) {
    return '#16a122';
  } if (soldCount > 1) {
    return '#50e3c2';
  }
  return '#d2f0f0';
}

export async function getLikerNFTDynamicData(classId, classData) {
  const { soldCount } = classData;
  const backgroundColor = await getDynamicBackgroundColor(soldCount);
  return {
    image: `https://${API_EXTERNAL_HOSTNAME}/likernft/metadata/image/class_${classId}.png`,
    backgroundColor,
  };
}

export function delay(n) {
  return new Promise(((resolve) => {
    setTimeout(resolve, n * 1000);
  }));
}
