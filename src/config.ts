import { HTTP, Schema } from 'koishi'

import I18nZhCN from './locales/zh-CN.yml'

export interface Config {
  traitCount: [number, number]
  attrNumPerLine: number
  ignoreScale: boolean
  requestConfig: HTTP.Config
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.intersect([
    Schema.object({
      traitCount: Schema.tuple([
        Schema.number().min(1),
        Schema.number().min(1),
      ]).default([4, 4]) as Schema<[number, number]>,
    }),
    Schema.object({
      attrNumPerLine: Schema.number().min(1).default(6),
      ignoreScale: Schema.boolean().default(false),
    }),
  ]).i18n({
    zh: I18nZhCN._config,
    'zh-CN': I18nZhCN._config,
  }),
  Schema.object({
    requestConfig: HTTP.createConfig(
      'https://raw.gitmirror.com/lgc-KoiDev/koishi-plugin-isekai-tensei/master/res/',
    ),
  }),
])
