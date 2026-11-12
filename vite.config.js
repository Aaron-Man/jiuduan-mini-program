import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// 查找项目根目录（包含 pages.json 的目录）
function findProjectRoot() {
    // 先尝试 import.meta.url 所在目录
    let dir = path.dirname(fileURLToPath(import.meta.url))
    if (fs.existsSync(path.join(dir, 'pages.json'))) return dir
    // 向上一级找
    dir = path.dirname(dir)
    if (fs.existsSync(path.join(dir, 'pages.json'))) return dir
    // 最后尝试 process.cwd()
    if (fs.existsSync(path.join(process.cwd(), 'pages.json'))) return process.cwd()
    return null
}

const projectRoot = findProjectRoot()

// 编译后自动复制云函数目录到输出
function copyCloudFunctions() {
    return {
        name: 'copy-cloud-functions',
        closeBundle() {
            if (!projectRoot) {
                console.warn('[插件] 未找到项目根目录，跳过复制云函数')
                return
            }
            try {
                const src = path.join(projectRoot, 'cloud')
                // 输出目录由 uni-app 通过 UNI_OUTPUT_DIR 提供（dev / build、HBuilderX / CLI 各不相同）
                const outDir = process.env.UNI_OUTPUT_DIR
                    ? path.resolve(process.env.UNI_OUTPUT_DIR)
                    : path.join(projectRoot, 'unpackage/dist/dev/mp-weixin')
                const dest = path.join(outDir, 'cloud')
                // 跨平台复制，不依赖 rm / cp 命令
                fs.rmSync(dest, { recursive: true, force: true })
                fs.cpSync(src, dest, {
                    recursive: true,
                    // 云函数依赖在云端安装，不复制本地 node_modules
                    filter: p => !p.split(path.sep).includes('node_modules'),
                })
                console.log(`[插件] 云函数目录已复制到 ${dest}`)
            } catch (e) {
                console.warn('[插件] 复制云函数目录失败:', e.message)
            }
        },
    }
}

export default defineConfig({
    plugins: [uni(), copyCloudFunctions()],
})
