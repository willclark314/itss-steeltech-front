<template>
  <el-card shadow="never">
    <template #header>
      <span>示例页面</span>
    </template>

    <p class="intro">
      这是「生产计划系统」下的示例页面，用于占位与后续功能扩展。当前仅演示系统导航与权限接入是否正常。
    </p>

    <el-descriptions :column="1" border label-width="120px">
      <el-descriptions-item label="所属系统">生产计划系统</el-descriptions-item>
      <el-descriptions-item label="页面说明">后续可在此模块下继续增加生产计划相关业务页面</el-descriptions-item>
    </el-descriptions>
  </el-card>
</template>

<style scoped>
.intro {
  margin: 0 0 20px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}
</style>
