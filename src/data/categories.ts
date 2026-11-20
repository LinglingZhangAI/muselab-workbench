import taxonomy from './21st-categories.json';
export {taxonomy};
export const categoryNames=taxonomy.map(c=>c.name);
const chineseLabels:Record<string,string>={
 announcement:'公告栏',background:'背景',border:'边框',cta:'行动引导',clients:'客户展示',comparison:'对比展示',dock:'快捷工具栏',faq:'常见问题',features:'功能介绍',footer:'页脚',gallery:'图片画廊',hero:'首屏展示',hook:'逻辑钩子',image:'图片素材',map:'地图',marquee:'滚动展示','navigation-menu':'导航菜单','pricing-section':'定价方案','scroll-area':'滚动区域',stat:'数据指标',steps:'步骤条',team:'团队介绍',testimonials:'用户评价',text:'文本',timeline:'时间线',video:'视频',accordion:'折叠面板','ai-chat':'智能对话',alert:'警告提示',avatar:'头像',badge:'徽标',button:'按钮',calendar:'日历',card:'卡片',carousel:'轮播图','data-visualization':'图表与数据可视化',checkbox:'复选框',cursor:'鼠标指针',dashboard:'仪表盘','date-picker':'日期选择器',modal:'对话框',dropdown:'下拉菜单','empty-state':'空状态','file-tree':'文件树','upload-download':'文件上传',form:'表单',globe:'地球仪',grid:'网格与拼贴布局',icon:'图标',input:'输入框',link:'链接',list:'列表',menu:'菜单',notification:'通知',number:'数字展示',onboarding:'新手引导',pagination:'分页',popover:'浮动面板',profile:'个人资料',progress:'进度条','radio-group':'单选组',search:'搜索框',select:'选择器',sidebar:'侧边栏','sign-in':'登录','sign-up':'注册',slider:'滑动条',spinner:'加载指示器',table:'表格',tabs:'标签页',chip:'标签',textarea:'多行输入框',toast:'轻提示',toggle:'开关',tooltip:'文字提示',collapsible:'可折叠区域'
};
export function categoryLabel(name:string){
 const category=taxonomy.find(c=>c.name===name);
 return category?chineseLabels[category.slug]||name:name;
}
const sections=['Heroes','Features','Calls to Action','Pricing Sections','Testimonials','FAQs','Team Sections','Footers','Clients','Comparisons','Dashboards','Profiles'];
export const uiFolderGroups=[
 {id:'pages',title:'页面与区块',color:'purple',children:categoryNames.filter(name=>sections.includes(name))},
 {id:'components',title:'界面组件',color:'blue',children:categoryNames.filter(name=>!sections.includes(name)&&name!=='Images')},
 {id:'materials',title:'素材与待处理',color:'pink',children:['Images','待分类','未分类']}
];
export function resolveCategory(category:string,slug?:string){
 return taxonomy.find(c=>c.slug===slug)?.name||taxonomy.find(c=>category.split('/').some(part=>part.trim().toLowerCase()===c.name.toLowerCase()))?.name||'待分类';
}
