import { crc32 } from 'node:zlib';

const max32 = 0xffffffff;

function dosTimestamp(modified) {
  const date = new Date(Math.min(Math.max(modified.getTime(), Date.UTC(1980, 0, 1)), Date.UTC(2107, 11, 31, 23, 59, 58)));
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
    date: ((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate()
  };
}

function zip64Extra(values) {
  if (!values.length) return Buffer.alloc(0);
  const extra = Buffer.alloc(4 + values.length * 8);
  extra.writeUInt16LE(1, 0);
  extra.writeUInt16LE(values.length * 8, 2);
  values.forEach((value, index) => extra.writeBigUInt64LE(BigInt(value), 4 + index * 8));
  return extra;
}

export async function* zipFiles(entries, readFile) {
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const size = entry.stat.size;
    const large = size >= max32;
    const timestamp = dosTimestamp(entry.stat.mtime);
    const extra = zip64Extra(large ? [size, size] : []);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(large ? 45 : 20, 4);
    header.writeUInt16LE(0x0808, 6);
    header.writeUInt16LE(timestamp.time, 10);
    header.writeUInt16LE(timestamp.date, 12);
    header.writeUInt32LE(large ? max32 : 0, 18);
    header.writeUInt32LE(large ? max32 : 0, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(extra.length, 28);
    const start = offset;
    const local = Buffer.concat([header, name, extra]);
    yield local;
    offset += local.length;
    let checksum = 0;
    let written = 0;
    for await (const chunk of readFile(entry)) {
      written += chunk.length;
      if (written > size) throw new Error('File grew while creating the archive');
      checksum = crc32(chunk, checksum);
      yield chunk;
      offset += chunk.length;
    }
    if (written !== size) throw new Error('File changed while creating the archive');
    const descriptor = Buffer.alloc(large ? 24 : 16);
    descriptor.writeUInt32LE(0x08074b50, 0);
    descriptor.writeUInt32LE(checksum, 4);
    if (large) {
      descriptor.writeBigUInt64LE(BigInt(size), 8);
      descriptor.writeBigUInt64LE(BigInt(size), 16);
    } else {
      descriptor.writeUInt32LE(size, 8);
      descriptor.writeUInt32LE(size, 12);
    }
    yield descriptor;
    offset += descriptor.length;
    const centralExtra = zip64Extra([...(large ? [size, size] : []), ...(start >= max32 ? [start] : [])]);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(45, 4);
    record.writeUInt16LE(large || start >= max32 ? 45 : 20, 6);
    record.writeUInt16LE(0x0808, 8);
    record.writeUInt16LE(timestamp.time, 12);
    record.writeUInt16LE(timestamp.date, 14);
    record.writeUInt32LE(checksum, 16);
    record.writeUInt32LE(large ? max32 : size, 20);
    record.writeUInt32LE(large ? max32 : size, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt16LE(centralExtra.length, 30);
    record.writeUInt32LE(Math.min(start, max32), 42);
    central.push(Buffer.concat([record, name, centralExtra]));
  }
  const centralOffset = offset;
  for (const record of central) {
    yield record;
    offset += record.length;
  }
  const centralSize = offset - centralOffset;
  if (centralOffset >= max32 || centralSize >= max32 || entries.length >= 0xffff) {
    const end64 = Buffer.alloc(56);
    end64.writeUInt32LE(0x06064b50, 0);
    end64.writeBigUInt64LE(44n, 4);
    end64.writeUInt16LE(45, 12);
    end64.writeUInt16LE(45, 14);
    end64.writeBigUInt64LE(BigInt(entries.length), 24);
    end64.writeBigUInt64LE(BigInt(entries.length), 32);
    end64.writeBigUInt64LE(BigInt(centralSize), 40);
    end64.writeBigUInt64LE(BigInt(centralOffset), 48);
    yield end64;
    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(0x07064b50, 0);
    locator.writeBigUInt64LE(BigInt(offset), 8);
    locator.writeUInt32LE(1, 16);
    yield locator;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Math.min(entries.length, 0xffff), 8);
  end.writeUInt16LE(Math.min(entries.length, 0xffff), 10);
  end.writeUInt32LE(Math.min(centralSize, max32), 12);
  end.writeUInt32LE(Math.min(centralOffset, max32), 16);
  yield end;
}
