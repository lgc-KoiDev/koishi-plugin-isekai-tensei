import { Context, HTTP } from 'koishi'

import { Config } from './config'
import { name } from './const'
import { DataSource } from './data'
import I18nZhCN from './locales/zh-CN.yml'
import { createTemplate } from './template'

import {} from '@koishijs/plugin-notifier'
import {} from 'koishi-plugin-puppeteer'

export { Config, name }
export const inject = ['http', 'notifier', 'component:html']

export const usage = `
素材来源：**<a href="https://nga.178.com/read.php?tid=29606608" target="_blank">NGA（点击跳转）</a>**
`.trim()

export async function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh-CN', I18nZhCN)
  ctx.i18n.define('zh', I18nZhCN)

  config.traitCount.sort((a, b) => a - b)
  let scaleFactor = 1
  if (!config.ignoreScale) {
    ctx.inject(['puppeteer'], (ctx) => {
      scaleFactor = ctx.puppeteer.config.defaultViewport!.deviceScaleFactor!
    })
  }

  const dataSource = new DataSource(ctx, config)

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
      if (!session || !options) return
      if (!(await dataSource.check())) return session.text('.missing-resource')
      return await createTemplate(
        config,
        dataSource,
        session,
        await dataSource.roll(options.seed),
        scaleFactor,
      )
    })
}
