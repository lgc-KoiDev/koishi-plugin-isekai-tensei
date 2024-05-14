import {} from '@koishijs/plugin-notifier'
import { Context, HTTP, Schema } from 'koishi'
import {} from 'koishi-plugin-puppeteer'

import { name } from './const'
import { DataSource } from './data'
import { createTemplate } from './template'

// @ts-ignore
import I18nZhCN from './locales/zh-CN'

export { name }
export const inject = ['http', 'notifier', 'puppeteer']

export const usage = `
素材来源：**<a href="https://nga.178.com/read.php?tid=29606608" target="_blank">NGA（点击跳转）</a>**
`.trim()

export interface Config {
  requestConfig: HTTP.Config
}

export const Config: Schema<Config> = Schema.intersect([
  // Schema.object({}).i18n({
  //   zh: I18nZhCN._config,
  //   'zh-CN': I18nZhCN._config,
  // }),
  Schema.object({
    requestConfig: HTTP.createConfig(
      'https://raw.gitmirror.com/lgc2333/koishi-plugin-isekai-tensei/master/res/',
    ),
  }),
])

export async function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh-CN', I18nZhCN)
  ctx.i18n.define('zh', I18nZhCN)

  const http = ctx.http.extend(config.requestConfig)
  const dataSource = new DataSource(ctx, http)

  const notifier = ctx.notifier.create()
  try {
    await dataSource.checkAndUpdate((msg) => notifier.update(msg))
  } catch (e) {
    ctx.logger.error(e)
    notifier.update({
      type: 'danger',
      content: `${HTTP.Error.is(e) ? '网络请求失败' : '出现错误'}，请检查日志输出`,
    })
    return
  }
  notifier.dispose()

  ctx
    .command(name)
    .option('seed', '-s [seed:number]')
    .action(async ({ options, session }) => {
      if (!(await dataSource.check())) return session.text('.missing-resource')
      return await createTemplate(
        dataSource,
        await dataSource.roll(options.seed),
        ctx.puppeteer.config.defaultViewport?.deviceScaleFactor ?? 1,
      )
    })
}
