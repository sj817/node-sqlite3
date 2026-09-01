/* eslint-disable @stylistic/indent */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { extract } from 'tar'

const name = 'sqlite3'

/**
 * 要打包的版本号。
 *
 * 本包的版本号与原生 sqlite3 包对齐,所以这一个值同时决定三件事:
 *   - 去哪个 GitHub Release 下二进制 (v${version})
 *   - 发布出去的主包版本号
 *   - 8 个平台子包的版本号
 *
 * 默认取仓库根目录 package.json 的版本号,也就是原生包最近一次发布的版本;
 * 回补历史版本时用 SQLITE3_VERSION 覆盖,例如 SQLITE3_VERSION=5.1.9。
 */
const version = process.env.SQLITE3_VERSION?.trim() ||
  (JSON.parse(
    fs.readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf-8')
  ).version as string)

const url = `https://api.github.com/repos/sj817/node-sqlite3/releases/tags/v${version}`

// 'sqlite3-v5.1.7-napi-v3-linuxmusl-arm64.tar.gz'
// name构成: sqlite3-v${version}-napi-v${napiVersion}-${platform}-${arch}.tar.gz

/**
 * 从 URL 获取 JSON 列表
 */
const fetchJsonList = async (): Promise<Array<{ name: string; url: string }>> => {
  console.log(`正在获取 JSON 列表: ${url}`)
  const options = process.env.GITHUB_TOKEN
    ? {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'esmify-sqlite3-build-script',
      },
    }
    : undefined
  const response = await fetch(url, options)

  if (!response.ok) {
    throw new Error(`获取 JSON 列表失败: ${response.statusText}`)
  }
  const json = await response.json() as {
    assets: Array<{
      url: string,
      id: number,
      node_id: string,
      name: string,
      label: string,
      uploader: {
        login: string,
        id: number,
        node_id: string,
        avatar_url: string,
        gravatar_id: string,
        url: string,
        html_url: string,
        followers_url: string,
        following_url: string,
        gists_url: string,
        starred_url: string,
        subscriptions_url: string,
        organizations_url: string,
        repos_url: string,
        events_url: string,
        received_events_url: string,
        type: string,
        user_view_type: string,
        site_admin: boolean
      },
      content_type: string,
      state: string,
      size: number,
      digest: string,
      download_count: number,
      created_at: string,
      updated_at: string,
      browser_download_url: string
    }>
  }
  console.log(`获取到 ${json.assets.length} 个文件`)
  return json.assets.map(asset => ({ name: asset.name, url: asset.browser_download_url }))
}

/**
 * 解析平台信息
 */
const parsePlatform = (target: string): {
  /** 平台 */
  platform: string
  /** 架构 */
  arch: string
  /** N-API 版本 */
  napi: string
} => {
  const parts = target.split('-')
  return {
    platform: parts[4],
    arch: parts[5].replace('.tar.gz', ''),
    napi: parts[3],
  }
}

/**
 * 根据平台和架构信息映射os和cpu字段
 */
const mapOsAndCpu = (platform: string, arch: string) => {
  // 映射平台名称到Node.js的process.platform值
  const osMap: Record<string, string[]> = {
    win32: ['win32'],
    darwin: ['darwin'],
    linux: ['linux'],
    linuxmusl: ['linux'],
  }

  // 映射架构名称到Node.js的process.arch值
  const cpuMap: Record<string, string[]> = {
    x64: ['x64'],
    ia32: ['ia32'],
    arm64: ['arm64'],
    arm: ['arm'],
  }

  const result: {
    os?: string[]
    cpu?: string[]
    libc?: string[]
  } = {}

  // 设置os字段
  if (osMap[platform]) {
    result.os = osMap[platform]
  }

  // 设置cpu字段
  if (cpuMap[arch]) {
    result.cpu = cpuMap[arch]
  }

  // 如果是linuxmusl,设置libc字段
  if (platform === 'linuxmusl') {
    result.libc = ['musl']
  } else if (platform === 'linux') {
    result.libc = ['glibc']
  }

  return result
}

/**
 * 构建对应平台包的package.json
 */
const createPkg = (target: string, version: string) => {
  const { platform, arch, napi } = parsePlatform(target)
  const { os, cpu, libc } = mapOsAndCpu(platform, arch)

  const pkg: any = {
    name: `@karinjs/sqlite3-napi-${napi}-${platform}-${arch}`,
    version,
    license: 'MIT',
    author: 'shijin',
    main: '',
    repository: {
      type: 'git',
      url: 'git+https://github.com/sj817/node-sqlite3.git',
    },
    files: [
      'dist',
    ],
    engines: {
      node: '>=10.20.0',
    },
    publishConfig: {
      access: 'public',
      registry: 'https://registry.npmjs.org',
    },
  }

  // 动态添加os、cpu、libc字段
  const addedFields: string[] = []

  if (os) {
    pkg.os = os
    addedFields.push(`os: ${JSON.stringify(os)}`)
  }

  if (cpu) {
    pkg.cpu = cpu
    addedFields.push(`cpu: ${JSON.stringify(cpu)}`)
  }

  if (libc) {
    pkg.libc = libc
    addedFields.push(`libc: ${JSON.stringify(libc)}`)
  }

  // 打印日志
  if (addedFields.length > 0) {
    console.log(`📦 ${pkg.name} 新增字段: ${addedFields.join(', ')}`)
  }

  return pkg
}

/**
 * 下载二进制文件
 */
const downloadBinary = async (target: { name: string; url: string }, tarFile: string) => {
  if (fs.existsSync(tarFile)) {
    console.log(`文件已存在: ${target.name}`)
    return
  }

  console.log(`下载 ${target.name}...`)
  const response = await fetch(target.url)
  if (!response.ok || !response.body) {
    throw new Error(`下载失败: ${response.statusText}`)
  }

  const fileStream = fs.createWriteStream(tarFile)
  const reader = response.body.getReader()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    fileStream.write(value)
  }

  fileStream.end()
  await new Promise((resolve, reject) => {
    fileStream.on('finish', resolve)
    fileStream.on('error', reject)
  })
  console.log(`下载完成: ${target.name}`)
}

/**
 * 解压二进制文件
 */
const extractBinary = async (tarFile: string, pkgDir: string, targetName: string) => {
  try {
    await extract({
      file: tarFile,
      cwd: pkgDir,
    })
    console.log(`解压完成: ${targetName}`)
  } catch (error) {
    throw new Error(`解压失败: ${targetName} - ${error}`)
  }
}

/**
 * 整理文件结构
 */
const organizeBuildFiles = (pkgDir: string, distDir: string) => {
  const buildDir = path.join(pkgDir, 'build', 'Release')
  if (!fs.existsSync(buildDir)) {
    throw new Error(`未找到build文件夹: ${buildDir}`)
  }

  fs.rmSync(distDir, { recursive: true, force: true })
  fs.renameSync(buildDir, distDir)
  fs.rmSync(path.join(pkgDir, 'build'), { recursive: true, force: true })
}

/**
 * 查找并返回.node文件
 */
const findNodeFile = (distDir: string): string | undefined => {
  return fs.readdirSync(distDir).find(file => file.endsWith('.node'))
}

/**
 * 写入package.json
 */
const writePackageJson = (pkgPath: string, pkg: any) => {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
  console.log(`创建 package.json: ${pkg.name}`)
}

/**
 * 处理单个平台包
 */
const processPlatformPackage = async (
  target: { name: string; url: string },
  dir: string,
  dirTemp: string,
  version: string
) => {
  // 去掉.tar.gz后缀作为包目录名
  const pkgDirName = target.name.replace('.tar.gz', '')
  const pkgDir = path.join(dir, pkgDirName)
  const distDir = path.join(pkgDir, 'dist')
  const tarFile = path.join(dirTemp, target.name)
  const pkg = createPkg(target.name, version)

  // 创建包目录
  if (!fs.existsSync(pkgDir)) {
    fs.mkdirSync(pkgDir, { recursive: true })
  }

  // 检查.node文件是否已存在
  let nodeFile: string | undefined
  if (fs.existsSync(distDir)) {
    nodeFile = findNodeFile(distDir)
    if (nodeFile) {
      console.log(`二进制文件已存在,跳过下载: ${nodeFile}`)
      // 更新package.json的main字段
      pkg.main = `dist/${nodeFile}`
      // 写入package.json
      const pkgPath = path.join(pkgDir, 'package.json')
      writePackageJson(pkgPath, pkg)
      return { pkgDir, distDir, nodeFile, pkg }
    }
  }

  // 下载二进制
  await downloadBinary(target, tarFile)

  // 解压二进制
  await extractBinary(tarFile, pkgDir, target.name)

  // 整理文件结构
  organizeBuildFiles(pkgDir, distDir)

  // 查找.node文件
  nodeFile = findNodeFile(distDir)
  if (!nodeFile) {
    throw new Error(`未找到二进制文件: ${distDir}`)
  }

  // 更新package.json的main字段
  pkg.main = `dist/${nodeFile}`
  console.log(`找到二进制文件: ${nodeFile}`)

  // 删除压缩包
  fs.unlinkSync(tarFile)
  console.log(`删除压缩包: ${tarFile}`)

  // 写入package.json
  const pkgPath = path.join(pkgDir, 'package.json')
  writePackageJson(pkgPath, pkg)

  return { pkgDir, distDir, nodeFile, pkg }
}

/**
 * 验证包的完整性
 */
const validatePackage = (result: {
  pkgDir: string
  distDir: string
  nodeFile: string
  pkg: any
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  // 检查包目录是否存在
  if (!fs.existsSync(result.pkgDir)) {
    errors.push(`包目录不存在: ${result.pkgDir}`)
  }

  // 检查dist目录是否存在
  if (!fs.existsSync(result.distDir)) {
    errors.push(`dist目录不存在: ${result.distDir}`)
  }

  // 检查.node文件是否存在
  const nodeFilePath = path.join(result.distDir, result.nodeFile)
  if (!fs.existsSync(nodeFilePath)) {
    errors.push(`.node文件不存在: ${nodeFilePath}`)
  } else {
    // 检查.node文件大小必须大于100KB
    const stats = fs.statSync(nodeFilePath)
    const fileSizeInKB = stats.size / 1024
    if (fileSizeInKB < 100) {
      errors.push(`.node文件大小不足100KB: ${nodeFilePath} (${fileSizeInKB.toFixed(2)}KB)`)
    } else {
      console.log(`.node文件大小验证通过: ${nodeFilePath} (${fileSizeInKB.toFixed(2)}KB)`)
    }
  }

  // 检查package.json是否存在
  const pkgPath = path.join(result.pkgDir, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    errors.push(`package.json不存在: ${pkgPath}`)
  } else {
    // 检查package.json内容
    try {
      const pkgContent = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      if (!pkgContent.name) {
        errors.push(`package.json缺少name字段: ${pkgPath}`)
      }
      if (!pkgContent.version) {
        errors.push(`package.json缺少version字段: ${pkgPath}`)
      }
      if (!pkgContent.main) {
        errors.push(`package.json缺少main字段: ${pkgPath}`)
      }
      if (pkgContent.main !== result.pkg.main) {
        errors.push(`package.json的main字段不匹配: ${pkgContent.main} vs ${result.pkg.main}`)
      }
    } catch (error) {
      errors.push(`package.json解析失败: ${pkgPath} - ${error}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * 获取npm publish会发布的文件列表
 */
const checkNpmPublishFiles = async (dir: string) => {
  const pkgDirs = fs.readdirSync(dir).filter(item => {
    const itemPath = path.join(dir, item)
    return fs.statSync(itemPath).isDirectory() && item.startsWith('sqlite3-')
  })

  for (const pkgDirName of pkgDirs) {
    const pkgPath = path.join(dir, pkgDirName)
    const pkgJsonPath = path.join(pkgPath, 'package.json')

    if (!fs.existsSync(pkgJsonPath)) {
      console.log(`❌ ${pkgDirName}: package.json不存在`)
      continue
    }

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
    console.log(`\n📦 ${pkgJson.name}`)

    try {
      // 使用npm pack --dry-run获取会发布的文件列表
      const output = execSync('npm pack --dry-run', {
        cwd: pkgPath,
        encoding: 'utf-8',
      })

      // 解析输出获取文件列表
      const lines = output.split('\n')
      const startIndex = lines.findIndex(line => line.includes('Tarball Contents'))
      const endIndex = lines.findIndex(line => line.includes('Tarball Details'))

      if (startIndex !== -1 && endIndex !== -1) {
        const fileLines = lines.slice(startIndex + 1, endIndex)
          .filter(line => line.includes('notice') && !line.includes('Tarball'))
          .map(line => line.replace('npm notice', '').trim())
          .filter(line => line)

        console.log(`  文件数量: ${fileLines.length}`)
        console.log('  文件列表:')
        fileLines.forEach(line => {
          console.log(`    ${line}`)
        })
      }

      // 提取关键信息
      const totalFilesLine = lines.find(line => line.includes('total files'))
      const unpackedSizeLine = lines.find(line => line.includes('unpacked size'))
      const packageSizeLine = lines.find(line => line.includes('package size'))

      if (totalFilesLine) {
        console.log(`  ${totalFilesLine.replace('npm notice', '').trim()}`)
      }
      if (packageSizeLine) {
        console.log(`  ${packageSizeLine.replace('npm notice', '').trim()}`)
      }
      if (unpackedSizeLine) {
        console.log(`  ${unpackedSizeLine.replace('npm notice', '').trim()}`)
      }
    } catch (error) {
      console.log(`  ❌ 获取文件列表失败: ${error}`)
    }
  }
}

/**
 * 主函数
 */
const main = async () => {
  const mainPkgPath = fileURLToPath(new URL('../package.json', import.meta.url))
  const mainPkg = JSON.parse(fs.readFileSync(mainPkgPath, 'utf-8'))
  const currentVersion = version
  console.log(`发布版本号: ${currentVersion}`)
  if (mainPkg.version !== currentVersion) {
    console.log(`  (package.json 里是 ${mainPkg.version},将被改写为 ${currentVersion})`)
  }

  // 从 URL 获取 JSON 列表
  const json = await fetchJsonList()

  const targets = json
    .filter(item => item.name.startsWith(name) && item.name.endsWith('.tar.gz'))
    .filter(item => !item.name.includes('napi-v3')) // 移除v3版本
  const dir = fileURLToPath(new URL('../packages', import.meta.url))
  const dirTemp = path.join(dir, 'temp')

  // 创建临时目录
  fs.mkdirSync(dirTemp, { recursive: true })

  // 处理所有包
  const results: Array<{
    target: { name: string; url: string }
    result: Awaited<ReturnType<typeof processPlatformPackage>>
  }> = []

  for (const target of targets) {
    try {
      const result = await processPlatformPackage(target, dir, dirTemp, currentVersion)
      results.push({ target, result })
      console.log('---')
    } catch (error) {
      console.error(`处理失败: ${target.name}`, error)
      throw error
    }
  }

  // 验证所有包
  console.log('\n开始验证所有包...')
  const validationErrors: Array<{ package: string; errors: string[] }> = []

  for (const { target, result } of results) {
    const validation = validatePackage(result)
    if (!validation.valid) {
      validationErrors.push({
        package: target.name,
        errors: validation.errors,
      })
    } else {
      console.log(`✓ ${target.name} 验证通过`)
    }
  }

  // 如果有验证错误,抛出异常
  if (validationErrors.length > 0) {
    console.error('\n验证失败的包:')
    validationErrors.forEach(({ package: pkg, errors }) => {
      console.error(`\n包: ${pkg}`)
      errors.forEach(error => console.error(`  - ${error}`))
    })
    throw new Error(`${validationErrors.length} 个包验证失败`)
  }

  console.log('\n所有包验证通过! 🎉')

  console.log('\n开始获取npm publish文件列表...')
  await checkNpmPublishFiles(dir)

  if (fs.existsSync(dirTemp)) {
    fs.rmSync(dirTemp, { recursive: true, force: true })
    console.log('\n已删除临时目录')
  }

  // 打印所有包的 package.json 里的 name 字段合集
  const pkgDirs = fs.readdirSync(dir).filter(item => {
    const itemPath = path.join(dir, item)
    return fs.statSync(itemPath).isDirectory() && item.startsWith('sqlite3-')
  })

  const pkgNames = []
  for (const pkgDirName of pkgDirs) {
    const pkgPath = path.join(dir, pkgDirName, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      pkgNames.push(pkgJson.name)
    }
  }
  console.log('\n所有包名合集:')
  console.log(pkgNames)

  // 更新主包的 package.json，添加 optionalDependencies
  // 构建 optionalDependencies 对象
  const optionalDependencies: Record<string, string> = {}
  for (const pkgName of pkgNames) {
    optionalDependencies[pkgName] = currentVersion
  }

  // 更新 package.json:版本号与平台包一并对齐到 currentVersion
  mainPkg.version = currentVersion
  mainPkg.optionalDependencies = optionalDependencies

  // 写回文件
  fs.writeFileSync(mainPkgPath, JSON.stringify(mainPkg, null, 2) + '\n')
  console.log('\n✓ 已更新主包 package.json 的 optionalDependencies 字段')
  console.log(`  版本号: ${currentVersion}`)
  console.log(`  包数量: ${pkgNames.length}`)
}

// 执行主函数
main().catch(error => {
  console.error('执行失败:', error)
  process.exit(1)
})
