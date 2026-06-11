<template>
  <el-card shadow="never">
    <template #header>
      <span>关于系统</span>
    </template>

    <p class="about-intro">
      ITSS Steeltech 是面向钢结构技术业务的内部管理平台，用于联系单与项目协同、人员档案及休假安排等日常管理工作。
    </p>

    <el-descriptions :column="1" border label-width="120px" class="about-section">
      <el-descriptions-item label="系统名称">ITSS Steeltech</el-descriptions-item>
      <el-descriptions-item label="使用单位">钢结构技术科</el-descriptions-item>
    </el-descriptions>

    <div class="about-group-title">功能模块</div>
    <el-descriptions :column="1" border label-width="120px" class="about-section">
      <el-descriptions-item label="门户">系统首页与关于信息</el-descriptions-item>
      <el-descriptions-item label="业务系统">联系单管理、项目信息维护</el-descriptions-item>
      <el-descriptions-item label="人员系统">人员档案管理、休假日历与记录</el-descriptions-item>
    </el-descriptions>

    <div class="about-group-title">使用说明</div>
    <ul class="about-list">
      <li>通过顶部标签切换「门户」「业务系统」「人员系统」进入对应功能。</li>
      <li>左侧菜单可打开具体页面；已打开的页面可在内容区标签栏中切换或关闭。</li>
    </ul>
  </el-card>
</template>

<style scoped>
.about-intro {
  margin: 0 0 20px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.about-group-title {
  margin: 20px 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.about-section :deep(.el-descriptions__label) {
  font-weight: 500;
}

.about-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}
</style>
