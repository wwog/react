import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  // If entries is not provided, will be automatically inferred from package.json
  entries: [
    // default
    "./src/index",
    // mkdist builder transpiles file-to-file keeping original sources structure
    // {
    //   builder: "mkdist",
    //   input: "./src/package/components/",
    //   outDir: "./build/components",
    // },
  ],
  clean: true,
  declaration: "node16",

  externals: ["react", "react-dom"],
  rollup: {
    emitCJS: false,
    // 分模块输出（preserveModules）：打成单文件时，消费者即使只用 cx 也会把整包拉进去——
    // 桶文件的模块级初始化会让打包器无法丢弃未使用的导出。按模块产出后，未用到的模块（事件系统、
    // worker 池等）可以整块被消费者的打包器丢掉。
    output: {
      format: "esm",
      entryFileNames: "[name].js",
      preserveModules: true,
      preserveModulesRoot: "src",
    },
    esbuild: {
      minify: true,
    },
  },
});
