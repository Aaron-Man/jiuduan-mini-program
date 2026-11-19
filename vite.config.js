import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// 源码在 src/，编译输出到 dist/mp-weixin/（见 package.json 的 UNI_OUTPUT_DIR）。
// 微信开发者工具打开项目根目录：小程序代码读 dist/mp-weixin/，云函数直接读 cloud/functions/（见 project.config.json），
// 所以不需要把云函数或其他文件拷贝到编译目录。
export default defineConfig({
    plugins: [uni()],
})
