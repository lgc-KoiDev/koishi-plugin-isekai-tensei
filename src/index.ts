import {} from '@koishijs/plugin-notifier'
import { Context, HTTP } from 'koishi'
import {} from 'koishi-plugin-puppeteer'

import { Config } from './config'
import { name } from './const'
import { DataSource } from './data'
import I18nZhCN from './locales/zh-CN.yml'
import { createTemplate } from './template'

export { Config, name }
export const inject = ['http', 'notifier', 'puppeteer']

export const usage = `
素材来源：**<a href="https://nga.178.com/read.php?tid=29606608" target="_blank">NGA（点击跳转）</a>**
`.trim()

export async function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh-CN', I18nZhCN)
  ctx.i18n.define('zh', I18nZhCN)
  config.traitCount.sort((a, b) => a - b)

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
      if (!(await dataSource.check())) return session.text('.missing-resource')
      return await createTemplate(
        ctx,
        config,
        dataSource,
        await dataSource.roll(options.seed),
      )
    })
}
