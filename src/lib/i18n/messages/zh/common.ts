import type { NsMessages } from "../types";

const common: Partial<NsMessages<"common">> = {
  back: "返回",
  close: "关闭",
  loading: "加载中…",
  notFoundMetaTitle: "页面不存在",
  notFoundTitle: "这个页面今天偷懒了",
  notFoundText: "找不到你要访问的内容。",
  notFoundCta: "返回今日",
  offlineMetaTitle: "离线",
  offlineTitle: "当前处于离线状态",
  offlineBody: "此页面尚未保存到本设备。请联网后重试。",
  offlineNote: "打开过的页面离线时仍可查看，姿态识别始终在你的手机上运行。",
  tryAgain: "重试",
  home: "首页",
};

export default common;
