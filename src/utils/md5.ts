import SparkMD5 from 'spark-md5'

export async function computeFileMd5(file: File, chunkSize = 2 * 1024 * 1024): Promise<string> {
  const spark = new SparkMD5.ArrayBuffer()
  let offset = 0
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize)
    const buffer = await chunk.arrayBuffer()
    spark.append(buffer)
    offset += chunkSize
  }
  return spark.end()
}
