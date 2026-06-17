class BinaryGenerator {
  constructor(rng) {
    this.rng = rng;
  }

  randomByte() {
    return this.rng ? this.rng.randomInt(0, 255) : Math.floor(Math.random() * 256);
  }

  randomBytes(count) {
    const bytes = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      bytes[i] = this.randomByte();
    }
    return bytes;
  }

  bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return Buffer.from(binary, 'binary').toString('base64');
  }

  buildJpeg(width = 100, height = 100) {
    const parts = [];
    const soi = [0xFF, 0xD8];
    parts.push(...soi);

    const app0 = [0xFF, 0xE0];
    const app0Data = [0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
    parts.push(...app0, ...app0Data);

    const dqt = [0xFF, 0xDB, 0x00, 0x43, 0x00];
    for (let i = 0; i < 64; i++) {
      dqt.push(this.randomByte());
    }
    parts.push(...dqt);

    const sof0 = [0xFF, 0xC0];
    const sof0Data = [
      0x00, 0x0B,
      0x08,
      (height >> 8) & 0xFF, height & 0xFF,
      (width >> 8) & 0xFF, width & 0xFF,
      0x03,
      0x01, 0x11, 0x00,
      0x02, 0x11, 0x01,
      0x03, 0x11, 0x01
    ];
    parts.push(...sof0, ...sof0Data);

    const dht = [0xFF, 0xC4, 0x00, 0x1F, 0x00];
    for (let i = 0; i < 16; i++) dht.push(this.randomByte() % 2);
    for (let i = 0; i < 12; i++) dht.push(this.randomByte());
    parts.push(...dht);

    const sos = [0xFF, 0xDA];
    const sosData = [
      0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00
    ];
    const scanData = this.randomBytes(width * height);
    parts.push(...sos, ...sosData, ...scanData);

    const eoi = [0xFF, 0xD9];
    parts.push(...eoi);

    return new Uint8Array(parts);
  }

  buildPng(width = 100, height = 100) {
    const parts = [];

    const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    parts.push(...signature);

    const ihdrData = [
      (width >> 24) & 0xFF, (width >> 16) & 0xFF, (width >> 8) & 0xFF, width & 0xFF,
      (height >> 24) & 0xFF, (height >> 16) & 0xFF, (height >> 8) & 0xFF, height & 0xFF,
      0x08,
      0x02,
      0x00, 0x00, 0x00
    ];
    parts.push(...this.buildPngChunk('IHDR', ihdrData));

    const rawData = this.randomBytes(height * (1 + width * 3));
    const deflateData = [0x78, 0x01, ...this.deflateSimple(rawData)];
    parts.push(...this.buildPngChunk('IDAT', deflateData));

    parts.push(...this.buildPngChunk('IEND', []));

    return new Uint8Array(parts);
  }

  buildPngChunk(type, data) {
    const result = [];
    const length = data.length;
    result.push((length >> 24) & 0xFF, (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF);

    const typeBytes = type.split('').map(c => c.charCodeAt(0));
    result.push(...typeBytes);
    result.push(...data);

    const crc = this.crc32([...typeBytes, ...data]);
    result.push((crc >> 24) & 0xFF, (crc >> 16) & 0xFF, (crc >> 8) & 0xFF, crc & 0xFF);

    return result;
  }

  crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  deflateSimple(data) {
    const result = [];
    const MAX_BLOCK = 65535;
    for (let i = 0; i < data.length; i += MAX_BLOCK) {
      const chunk = data.slice(i, i + MAX_BLOCK);
      const isLast = (i + MAX_BLOCK) >= data.length;
      result.push(isLast ? 0x01 : 0x00);
      const len = chunk.length;
      result.push(len & 0xFF, (len >> 8) & 0xFF);
      result.push((~len) & 0xFF, ((~len) >> 8) & 0xFF);
      result.push(...chunk);
    }
    return result;
  }

  buildGif(width = 100, height = 100) {
    const parts = [];
    const header = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
    parts.push(...header);
    parts.push(width & 0xFF, (width >> 8) & 0xFF);
    parts.push(height & 0xFF, (height >> 8) & 0xFF);
    parts.push(0xF7, 0x00, 0x00);
    for (let i = 0; i < 256; i++) {
      parts.push(this.randomByte(), this.randomByte(), this.randomByte());
    }
    const graphicControl = [0x21, 0xF9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00];
    parts.push(...graphicControl);
    const imageDescriptor = [0x2C, 0x00, 0x00, 0x00, 0x00];
    imageDescriptor.push(width & 0xFF, (width >> 8) & 0xFF);
    imageDescriptor.push(height & 0xFF, (height >> 8) & 0xFF);
    imageDescriptor.push(0x00);
    parts.push(...imageDescriptor);
    parts.push(0x08, 0x00);
    for (let i = 0; i < 20; i++) {
      parts.push(this.randomByte());
    }
    parts.push(0x00);
    parts.push(0x3B);
    return new Uint8Array(parts);
  }

  buildBmp(width = 100, height = 100) {
    const parts = [];
    const pixelDataSize = width * height * 3;
    const fileSize = 54 + pixelDataSize;
    const fileHeader = [
      0x42, 0x4D,
      fileSize & 0xFF, (fileSize >> 8) & 0xFF, (fileSize >> 16) & 0xFF, (fileSize >> 24) & 0xFF,
      0x00, 0x00, 0x00, 0x00,
      0x36, 0x00, 0x00, 0x00
    ];
    parts.push(...fileHeader);
    const infoHeader = [
      0x28, 0x00, 0x00, 0x00,
      width & 0xFF, (width >> 8) & 0xFF, (width >> 16) & 0xFF, (width >> 24) & 0xFF,
      height & 0xFF, (height >> 8) & 0xFF, (height >> 16) & 0xFF, (height >> 24) & 0xFF,
      0x01, 0x00,
      0x18, 0x00,
      0x00, 0x00, 0x00, 0x00,
      pixelDataSize & 0xFF, (pixelDataSize >> 8) & 0xFF, (pixelDataSize >> 16) & 0xFF, (pixelDataSize >> 24) & 0xFF,
      0x13, 0x0B, 0x00, 0x00,
      0x13, 0x0B, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00
    ];
    parts.push(...infoHeader);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        parts.push(this.randomByte(), this.randomByte(), this.randomByte());
      }
    }
    return new Uint8Array(parts);
  }

  buildWebp(width = 100, height = 100) {
    const parts = [];
    const riffData = [];
    riffData.push(0x57, 0x45, 0x42, 0x50);
    riffData.push(0x56, 0x50, 0x38, 0x20);
    const vp8Payload = [
      0x9D, 0x01, 0x2A,
      0x01, 0x00,
      (width & 0x3F) | 0x40, ((width >> 6) & 0xFF),
      (height & 0x3F) | 0x40, ((height >> 6) & 0xFF)
    ];
    for (let i = 0; i < 500; i++) {
      vp8Payload.push(this.randomByte());
    }
    const vp8Size = vp8Payload.length;
    riffData.push(vp8Size & 0xFF, (vp8Size >> 8) & 0xFF, (vp8Size >> 16) & 0xFF, (vp8Size >> 24) & 0xFF);
    riffData.push(...vp8Payload);
    if (riffData.length % 2 === 1) riffData.push(0x00);
    const riffSize = riffData.length;
    parts.push(0x52, 0x49, 0x46, 0x46);
    parts.push(riffSize & 0xFF, (riffSize >> 8) & 0xFF, (riffSize >> 16) & 0xFF, (riffSize >> 24) & 0xFF);
    parts.push(...riffData);
    return new Uint8Array(parts);
  }

  buildSvg(width = 100, height = 100) {
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33F5', '#33FFF5', '#F5FF33'];
    const color1 = colors[this.rng ? this.rng.randomInt(0, colors.length - 1) : Math.floor(Math.random() * colors.length)];
    const color2 = colors[this.rng ? this.rng.randomInt(0, colors.length - 1) : Math.floor(Math.random() * colors.length)];
    const cx = this.rng ? this.rng.randomInt(10, width - 10) : Math.floor(Math.random() * (width - 20)) + 10;
    const cy = this.rng ? this.rng.randomInt(10, height - 10) : Math.floor(Math.random() * (height - 20)) + 10;
    const r = this.rng ? this.rng.randomInt(10, Math.min(width, height) / 3) : Math.floor(Math.random() * (Math.min(width, height) / 3 - 10)) + 10;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${color1}"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color2}"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="${Math.floor(Math.min(width, height) / 6)}" fill="white">Test</text>
</svg>`;
    const encoder = new TextEncoder();
    return encoder.encode(svg);
  }

  buildPdf(pages = 1) {
    const content = [];
    const objects = [];
    content.push('%PDF-1.7\n');
    content.push('%âãÏÓ\n');
    const fontObjId = objects.length + 1;
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
    const catalogObjId = objects.length + 1;
    const pagesObjId = objects.length + 2;
    const pageObjs = [];
    const contentObjs = [];
    for (let i = 0; i < pages; i++) {
      const contentObjId = objects.length + 1 + 2 + i * 2;
      const pageObjId = contentObjId + 1;
      contentObjs.push(contentObjId);
      pageObjs.push(pageObjId);
      const textContent = `BT /F1 12 Tf 50 750 Td (Sample PDF Page ${i + 1}) Tj ET`;
      objects.push(`<< /Length ${textContent.length} >>\nstream\n${textContent}\nendstream`);
      objects.push(`<< /Type /Page /Parent ${pagesObjId} 0 R /MediaBox [0 0 612 792] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 ${fontObjId} 0 R >> >> >>`);
    }
    objects.push(`<< /Type /Pages /Count ${pages} /Kids [${pageObjs.map(id => `${id} 0 R`).join(' ')}] >>`);
    objects.push(`<< /Type /Catalog /Pages ${pagesObjId} 0 R >>`);
    const offsets = [];
    let position = content.join('').length;
    for (let i = 0; i < objects.length; i++) {
      offsets.push(position);
      const objStr = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
      content.push(objStr);
      position += objStr.length;
    }
    const xrefStart = content.join('').length;
    content.push(`xref\n0 ${objects.length + 1}\n`);
    content.push('0000000000 65535 f \n');
    for (const offset of offsets) {
      content.push(String(offset).padStart(10, '0') + ' 00000 n \n');
    }
    content.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
    const encoder = new TextEncoder();
    return encoder.encode(content.join(''));
  }

  buildZip(fileCount = 2) {
    const parts = [];
    const centralDir = [];
    let offset = 0;
    const fileContents = [];
    for (let i = 0; i < fileCount; i++) {
      const filename = `file_${i + 1}.txt`;
      const content = `This is sample file ${i + 1} content for testing zip functionality.\nRandom data: ${this.randomBytes(50).toString('hex')}\n`;
      fileContents.push({ filename, content });
    }
    for (const file of fileContents) {
      const filenameBytes = new TextEncoder().encode(file.filename);
      const contentBytes = new TextEncoder().encode(file.content);
      const crc32Val = this.crc32([...contentBytes]);
      const localHeader = [];
      localHeader.push(0x50, 0x4B, 0x03, 0x04);
      localHeader.push(0x14, 0x00);
      localHeader.push(0x00, 0x00);
      localHeader.push(0x00, 0x00);
      localHeader.push(0x00, 0x00);
      localHeader.push(0x00, 0x00);
      const len = contentBytes.length;
      localHeader.push(crc32Val & 0xFF, (crc32Val >> 8) & 0xFF, (crc32Val >> 16) & 0xFF, (crc32Val >> 24) & 0xFF);
      localHeader.push(len & 0xFF, (len >> 8) & 0xFF, (len >> 16) & 0xFF, (len >> 24) & 0xFF);
      localHeader.push(len & 0xFF, (len >> 8) & 0xFF, (len >> 16) & 0xFF, (len >> 24) & 0xFF);
      localHeader.push(filenameBytes.length & 0xFF, (filenameBytes.length >> 8) & 0xFF);
      localHeader.push(0x00, 0x00);
      const localHeaderStart = parts.length;
      parts.push(...localHeader, ...filenameBytes, ...contentBytes);
      const localHeaderSize = parts.length - localHeaderStart;
      const cdEntry = [];
      cdEntry.push(0x50, 0x4B, 0x01, 0x02);
      cdEntry.push(0x14, 0x00);
      cdEntry.push(0x14, 0x00);
      cdEntry.push(0x00, 0x00);
      cdEntry.push(0x00, 0x00);
      cdEntry.push(0x00, 0x00);
      cdEntry.push(crc32Val & 0xFF, (crc32Val >> 8) & 0xFF, (crc32Val >> 16) & 0xFF, (crc32Val >> 24) & 0xFF);
      cdEntry.push(len & 0xFF, (len >> 8) & 0xFF, (len >> 16) & 0xFF, (len >> 24) & 0xFF);
      cdEntry.push(len & 0xFF, (len >> 8) & 0xFF, (len >> 16) & 0xFF, (len >> 24) & 0xFF);
      cdEntry.push(filenameBytes.length & 0xFF, (filenameBytes.length >> 8) & 0xFF);
      cdEntry.push(0x00, 0x00);
      cdEntry.push(0x00, 0x00);
      cdEntry.push(0x00, 0x00);
      cdEntry.push(0x00, 0x00);
      cdEntry.push(0x00, 0x00, 0x00, 0x00);
      cdEntry.push(offset & 0xFF, (offset >> 8) & 0xFF, (offset >> 16) & 0xFF, (offset >> 24) & 0xFF);
      cdEntry.push(...filenameBytes);
      centralDir.push(...cdEntry);
      offset += localHeaderSize;
    }
    const cdStart = parts.length;
    parts.push(...centralDir);
    const cdSize = centralDir.length;
    const eocd = [];
    eocd.push(0x50, 0x4B, 0x05, 0x06);
    eocd.push(0x00, 0x00);
    eocd.push(0x00, 0x00);
    eocd.push(fileCount & 0xFF, (fileCount >> 8) & 0xFF);
    eocd.push(fileCount & 0xFF, (fileCount >> 8) & 0xFF);
    eocd.push(cdSize & 0xFF, (cdSize >> 8) & 0xFF, (cdSize >> 16) & 0xFF, (cdSize >> 24) & 0xFF);
    eocd.push(cdStart & 0xFF, (cdStart >> 8) & 0xFF, (cdStart >> 16) & 0xFF, (cdStart >> 24) & 0xFF);
    eocd.push(0x00, 0x00);
    parts.push(...eocd);
    return new Uint8Array(parts);
  }

  buildGzip() {
    const parts = [];
    const text = 'Sample compressed data for GZIP testing purposes. ' + this.randomBytes(100).toString('hex');
    const textBytes = new TextEncoder().encode(text);
    parts.push(0x1F, 0x8B);
    parts.push(0x08);
    parts.push(0x00);
    parts.push(0x00, 0x00, 0x00, 0x00);
    parts.push(0x00);
    parts.push(0x03);
    const deflateBlocks = this.deflateSimple(textBytes);
    parts.push(0x78, 0x9C, ...deflateBlocks);
    let crc32Val = this.crc32([...textBytes]);
    parts.push(crc32Val & 0xFF, (crc32Val >> 8) & 0xFF, (crc32Val >> 16) & 0xFF, (crc32Val >> 24) & 0xFF);
    const isize = textBytes.length;
    parts.push(isize & 0xFF, (isize >> 8) & 0xFF, (isize >> 16) & 0xFF, (isize >> 24) & 0xFF);
    return new Uint8Array(parts);
  }

  buildMp3(duration = 1) {
    const parts = [];
    const id3 = [];
    id3.push(0x49, 0x44, 0x33);
    id3.push(0x04, 0x00);
    id3.push(0x00);
    const titleFrame = [];
    titleFrame.push(0x54, 0x49, 0x54, 0x32);
    const titleText = new TextEncoder().encode('Test Audio Track');
    const titleContent = [0x03, ...titleText];
    const titleLen = titleContent.length;
    titleFrame.push(0x00, 0x00, (titleLen >> 8) & 0xFF, titleLen & 0xFF);
    titleFrame.push(0x00, 0x00);
    titleFrame.push(...titleContent);
    const id3ContentSize = titleFrame.length;
    id3.push(0x00, 0x00, (id3ContentSize >> 7) & 0x7F, id3ContentSize & 0x7F);
    id3.push(...titleFrame);
    parts.push(...id3);
    const frameCount = duration * 25;
    for (let i = 0; i < frameCount; i++) {
      parts.push(0xFF, 0xFB, 0x90, 0x00);
      const frameData = this.randomBytes(413);
      parts.push(...frameData);
    }
    return new Uint8Array(parts);
  }

  buildWav(seconds = 1, sampleRate = 44100) {
    const parts = [];
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = sampleRate * seconds * numChannels * bitsPerSample / 8;
    const chunkSize = 36 + dataSize;
    parts.push(0x52, 0x49, 0x46, 0x46);
    parts.push(chunkSize & 0xFF, (chunkSize >> 8) & 0xFF, (chunkSize >> 16) & 0xFF, (chunkSize >> 24) & 0xFF);
    parts.push(0x57, 0x41, 0x56, 0x45);
    parts.push(0x66, 0x6D, 0x74, 0x20);
    parts.push(0x10, 0x00, 0x00, 0x00);
    parts.push(0x01, 0x00);
    parts.push(numChannels & 0xFF, (numChannels >> 8) & 0xFF);
    parts.push(sampleRate & 0xFF, (sampleRate >> 8) & 0xFF, (sampleRate >> 16) & 0xFF, (sampleRate >> 24) & 0xFF);
    parts.push(byteRate & 0xFF, (byteRate >> 8) & 0xFF, (byteRate >> 16) & 0xFF, (byteRate >> 24) & 0xFF);
    parts.push(blockAlign & 0xFF, (blockAlign >> 8) & 0xFF);
    parts.push(bitsPerSample & 0xFF, (bitsPerSample >> 8) & 0xFF);
    parts.push(0x64, 0x61, 0x74, 0x61);
    parts.push(dataSize & 0xFF, (dataSize >> 8) & 0xFF, (dataSize >> 16) & 0xFF, (dataSize >> 24) & 0xFF);
    const totalSamples = sampleRate * seconds;
    for (let i = 0; i < totalSamples; i++) {
      const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5 + (Math.random() - 0.5) * 0.2;
      const intSample = Math.floor(sample * 32767);
      parts.push(intSample & 0xFF, (intSample >> 8) & 0xFF);
    }
    return new Uint8Array(parts);
  }

  buildMp4(duration = 1) {
    const parts = [];
    const ftypBox = this.buildMp4Box('ftyp', [
      0x69, 0x73, 0x6F, 0x6D,
      0x00, 0x00, 0x02, 0x00,
      0x69, 0x73, 0x6F, 0x6D,
      0x69, 0x73, 0x70, 0x34,
      0x6D, 0x70, 0x34, 0x31
    ]);
    parts.push(...ftypBox);
    const moovContent = [];
    const mvhd = [
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x03, 0xE8,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x01, 0x00, 0x00,
      0x00, 0x01, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x01, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x01, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x40, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x02,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00
    ];
    moovContent.push(...this.buildMp4Box('mvhd', mvhd));
    const trakContent = [];
    const tkhd = [
      0x00, 0x00, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x03, 0xE8,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x01, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x40, 0x00,
      0x00, 0x00, 0x00, 0x00
    ];
    trakContent.push(...this.buildMp4Box('tkhd', tkhd));
    const mdiaContent = [];
    const mdhd = [
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x03, 0xE8,
      0x55, 0xC4, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x6C, 0x61, 0x76, 0x63,
      0x00, 0x00, 0x00, 0x00
    ];
    mdiaContent.push(...this.buildMp4Box('mdhd', mdhd));
    const hdlr = [
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x76, 0x69, 0x64, 0x65,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x56, 0x69, 0x64, 0x65,
      0x6F, 0x48, 0x61, 0x6E,
      0x64, 0x6C, 0x65, 0x72, 0x00
    ];
    mdiaContent.push(...this.buildMp4Box('hdlr', hdlr));
    mdiaContent.push(0x6D, 0x69, 0x6E, 0x66, 0x00, 0x00, 0x00, 0x28, 0x76, 0x6D, 0x68, 0x64, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
    trakContent.push(...this.buildMp4Box('mdia', mdiaContent));
    moovContent.push(...this.buildMp4Box('trak', trakContent));
    parts.push(...this.buildMp4Box('moov', moovContent));
    const mdatSize = 1000;
    parts.push(mdatSize & 0xFF, (mdatSize >> 8) & 0xFF, (mdatSize >> 16) & 0xFF, (mdatSize >> 24) & 0xFF);
    parts.push(0x6D, 0x64, 0x61, 0x74);
    parts.push(...this.randomBytes(mdatSize - 8));
    return new Uint8Array(parts);
  }

  buildMp4Box(type, data) {
    const result = [];
    const size = 8 + data.length;
    result.push(size & 0xFF, (size >> 8) & 0xFF, (size >> 16) & 0xFF, (size >> 24) & 0xFF);
    result.push(...type.split('').map(c => c.charCodeAt(0)));
    result.push(...data);
    return result;
  }

  buildDocx() {
    return this.buildZip(3);
  }

  buildXlsx() {
    return this.buildZip(5);
  }

  buildBinary(size = 1024) {
    return this.randomBytes(size);
  }

  generate(format, options = {}) {
    let bytes;
    const rngBackup = this.rng;

    switch (format) {
      case 'imageJpeg':
      case 'imageJpg':
        bytes = this.buildJpeg(options.width || 200, options.height || 200);
        return {
          mimeType: 'image/jpeg',
          dataUrl: `data:image/jpeg;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'jpg'
        };
      case 'imagePng':
        bytes = this.buildPng(options.width || 200, options.height || 200);
        return {
          mimeType: 'image/png',
          dataUrl: `data:image/png;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'png'
        };
      case 'imageGif':
        bytes = this.buildGif(options.width || 200, options.height || 200);
        return {
          mimeType: 'image/gif',
          dataUrl: `data:image/gif;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'gif'
        };
      case 'imageBmp':
        bytes = this.buildBmp(options.width || 100, options.height || 100);
        return {
          mimeType: 'image/bmp',
          dataUrl: `data:image/bmp;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'bmp'
        };
      case 'imageWebp':
        bytes = this.buildWebp(options.width || 200, options.height || 200);
        return {
          mimeType: 'image/webp',
          dataUrl: `data:image/webp;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'webp'
        };
      case 'imageSvg':
        bytes = this.buildSvg(options.width || 200, options.height || 200);
        return {
          mimeType: 'image/svg+xml',
          dataUrl: `data:image/svg+xml;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          svg: new TextDecoder().decode(bytes),
          size: bytes.length,
          extension: 'svg'
        };
      case 'pdf':
      case 'applicationPdf':
        bytes = this.buildPdf(options.pages || 1);
        return {
          mimeType: 'application/pdf',
          dataUrl: `data:application/pdf;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'pdf'
        };
      case 'zip':
      case 'applicationZip':
        bytes = this.buildZip(options.fileCount || 2);
        return {
          mimeType: 'application/zip',
          dataUrl: `data:application/zip;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'zip'
        };
      case 'gzip':
        bytes = this.buildGzip();
        return {
          mimeType: 'application/gzip',
          dataUrl: `data:application/gzip;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'gz'
        };
      case 'audioMp3':
        bytes = this.buildMp3(options.duration || 1);
        return {
          mimeType: 'audio/mpeg',
          dataUrl: `data:audio/mpeg;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'mp3'
        };
      case 'audioWav':
        bytes = this.buildWav(options.seconds || 1, options.sampleRate || 22050);
        return {
          mimeType: 'audio/wav',
          dataUrl: `data:audio/wav;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'wav'
        };
      case 'videoMp4':
        bytes = this.buildMp4(options.duration || 1);
        return {
          mimeType: 'video/mp4',
          dataUrl: `data:video/mp4;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'mp4'
        };
      case 'doc':
      case 'docx':
        bytes = this.buildDocx();
        return {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dataUrl: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'docx'
        };
      case 'xls':
      case 'xlsx':
        bytes = this.buildXlsx();
        return {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dataUrl: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'xlsx'
        };
      case 'binary':
      case 'rawBinary':
        bytes = this.buildBinary(options.size || 1024);
        return {
          mimeType: 'application/octet-stream',
          dataUrl: `data:application/octet-stream;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          hex: Buffer.from(bytes).toString('hex'),
          size: bytes.length,
          extension: 'bin'
        };
      default:
        bytes = this.buildBinary(512);
        return {
          mimeType: 'application/octet-stream',
          dataUrl: `data:application/octet-stream;base64,${this.bytesToBase64(bytes)}`,
          base64: this.bytesToBase64(bytes),
          size: bytes.length,
          extension: 'bin'
        };
    }
  }
}

module.exports = BinaryGenerator;
