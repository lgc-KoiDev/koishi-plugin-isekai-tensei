import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { Context, HTTP, pick } from 'koishi'
import seedRandom from 'seedrandom'
import Semaphore from 'semaphore-promise'

import { Config } from './config'
import { name } from './const'

export interface AttributeItem {
  name: string
  imagePath: string
  description: string
  points: number
}

export interface FontInfo {
  family: string
  path: string
}

export type SpecieAttributeItem = AttributeItem & {
  /** 让世界局势中的点数左右对调 */
  reverseSituationPoint?: boolean
}

export interface CharacterBasicAbilitiesData {
  /** 力量 */
  power: AttributeItem[]
  /** 魔力 */
  magic: AttributeItem[]
  /** 智力 */
  intelligence: AttributeItem[]
  /** 体质 */
  physique: AttributeItem[]
  /** 魅力 */
  charm: AttributeItem[]
  /** 运气 */
  luck: AttributeItem[]
}

export interface ManifestData {
  version: number
  fonts: FontInfo[]
  /** 种族 */
  species: SpecieAttributeItem[]
  /** 性别 */
  genders: AttributeItem[]
  /** 世界局势 */
  worldSituations: AttributeItem[]
  /** 开局状态 */
  initialStatuses: AttributeItem[]
  /** 居民风貌 */
  residentStyles: AttributeItem[]
  /** 基础能力 */
  basicAbilities: CharacterBasicAbilitiesData
  /** 特质 自由选择 */
  traits: AttributeItem[]
}

export type CharacterBasicAbilitiesSelection = {
  [key in keyof CharacterBasicAbilitiesData]: AttributeItem
}

export interface CharacterAttributesSelection {
  /** 种子 */
  seed: number
  /** 总点数 */
  totalPoints: number
  /** 种族 */
  specie: AttributeItem
  /** 性别 */
  gender: AttributeItem
  /** 世界局势 */
  worldSituation: AttributeItem
  /** 开局状态 */
  initialStatus: AttributeItem
  /** 居民风貌 */
  residentStyle: AttributeItem
  /** 基础能力 */
  basicAbilities: CharacterBasicAbilitiesSelection
  /** 特质 (随机 x4) */
  traits: AttributeItem[]
}

export function isDev() {
  // return false
  return process.env.NODE_ENV === 'development'
}

const MANIFEST_JSON_NAME = 'manifest.json'

export class DataSource {
  public readonly dataPath: string

  protected http: HTTP

  constructor(
    protected ctx: Context,
    protected config: Config,
  ) {
    this.http = ctx.http.extend(config.requestConfig)
    this.dataPath = isDev()
      ? path.join(__dirname, '..', 'res')
      : path.join(process.cwd(), 'cache', name)
  }

  get manifestPath() {
    return path.join(this.dataPath, MANIFEST_JSON_NAME)
  }

  async readManifest() {
    return JSON.parse(
      await readFile(this.manifestPath, { encoding: 'utf-8' }),
    ) as ManifestData
  }

  async checkMissingResources() {
    const manifest = await this.readManifest()
    const paths = [
      ...(
        [
          ...Object.values(
            pick(manifest, [
              'species',
              'genders',
              'worldSituations',
              'initialStatuses',
              'residentStyles',
              'traits',
            ]),
          ),
          ...Object.values(manifest.basicAbilities),
        ] as AttributeItem[][]
      )
        .flat()
        .map((it) => it.imagePath),
      ...manifest.fonts.map((it) => it.path),
    ]
    return paths.filter((it) => !existsSync(path.join(this.dataPath, it)))
  }

  async check() {
    if (!existsSync(this.manifestPath)) return false
    return !(await this.checkMissingResources()).length
  }

  async checkAndUpdate(notify?: (msg: string) => any) {
    if (isDev()) {
      if (!(await this.check())) {
        this.checkMissingResources()
          .then((ls) => this.ctx.logger.warn(`\n${ls.join('\n')}`))
          .catch((e) => {
            this.ctx.logger.warn('Possibly manifest JSON missing')
            this.ctx.logger.warn(e)
          })
        throw new Error('Missing resource in develop mode')
      }
      return
    }

    this.ctx.logger.info('Checking manifest and resources availability')
    notify?.('正在检查资源完整性……')
    let newManifest: ManifestData
    try {
      newManifest = await this.http.get(`/${MANIFEST_JSON_NAME}`, {
        responseType: 'json',
      })
      if (newManifest.version === undefined) throw new Error('Invalid manifest')
    } catch (e) {
      this.ctx.logger.warn(
        `Failed to fetch manifest, checking local resource usability\n${e}`,
      )
      // this.ctx.logger.warn(e)
      if (await this.check()) {
        this.ctx.logger.info('Local resource is usable, will skip update')
        return
      }
      throw e
    }

    const oldVersion = existsSync(this.manifestPath)
      ? (await this.readManifest()).version
      : 'Not Found'
    if (newManifest.version !== oldVersion) {
      if (!existsSync(this.dataPath)) {
        await mkdir(this.dataPath, { recursive: true })
      }
      await writeFile(this.manifestPath, JSON.stringify(newManifest, null, 2))
      this.ctx.logger.info(
        `Updated manifest from version ${oldVersion} to ${newManifest.version}`,
      )
    }
    const missingResources = await this.checkMissingResources()
    if (!missingResources.length) {
      this.ctx.logger.info('No missing resources found')
      return
    }

    this.ctx.logger.info('Downloading missing resources')
    await this.downloadResources(missingResources, notify)
    this.ctx.logger.success('Successfully downloaded resources')
  }

  protected async downloadResources(paths: string[], notify?: (msg: string) => any) {
    const singleTask = async (filePath: string) => {
      // retry 3 times
      const retryTimes = 3
      for (let i = 1; ; i += 1) {
        try {
          const data = await this.http.get(`/${filePath}`, {
            responseType: 'arraybuffer',
          })
          const realPath = path.join(this.dataPath, filePath)
          const realDir = path.dirname(realPath)
          if (!existsSync(realDir)) await mkdir(realDir, { recursive: true })
          await writeFile(realPath, Buffer.from(data))
          return
        } catch (e) {
          this.ctx.logger.debug(`Fetch ${filePath} failed, tried ${i} / ${retryTimes}`)
          this.ctx.logger.debug(e)
          if (i >= retryTimes) throw e
        }
      }
    }

    let completed = 0
    const updateNotify = () =>
      notify?.(`下载缺失资源中…… | 已下载 ${completed} / ${paths.length}`)
    const sem = new Semaphore(8)
    const tasks = paths.map((path, i) =>
      sem.acquire().then(async (release) => {
        this.ctx.logger.debug(`Downloading resource ${i + 1}/${paths.length}`)
        try {
          await singleTask(path)
        } finally {
          completed += 1
          updateNotify()
          release()
        }
      }),
    )
    await Promise.all(tasks)
  }

  async readAsDataUrl(filePath: string) {
    return `data:image/png;base64,${await readFile(path.join(this.dataPath, filePath), 'base64')}`
  }

  async roll(seed?: number): Promise<CharacterAttributesSelection> {
    const manifest = await this.readManifest()

    if (!seed) {
      seed = crypto.getRandomValues(new Uint32Array(1))[0]
    }
    const rng = seedRandom(`${seed}`)
    const rollItem = <T>(items: T[]): T => items[Math.floor(rng() * items.length)]
    const rollRange = (min: number, max: number): number => {
      min = Math.ceil(min)
      max = Math.floor(max)
      return Math.floor(rng() * (max - min + 1)) + min
    }

    const [specie, gender, worldSituation, initialStatus, residentStyle] = (
      Object.values(
        pick(manifest, [
          'species',
          'genders',
          'worldSituations',
          'initialStatuses',
          'residentStyles',
        ]),
      ) as any as AttributeItem[][]
    ).map(rollItem)
    const basicAbilities = Object.fromEntries(
      Object.entries(manifest.basicAbilities).map(([k, v]) => [k, rollItem(v)]),
    ) as CharacterBasicAbilitiesSelection

    const traitCount = (() => {
      const x = rollRange(...this.config.traitCount)
      const maxLen = manifest.traits.length
      if (x > maxLen) {
        this.ctx.logger.warn(
          `Rolled trait count is bigger than total traits count (${maxLen})! ` +
            `Check your configuration!!!`,
        )
        return maxLen
      }
      return x
    })()
    const traits: AttributeItem[] = []
    for (; traits.length < traitCount; ) {
      const trait = rollItem(manifest.traits)
      if (!traits.some((it) => it.name === trait.name)) {
        traits.push(trait)
      }
    }
    traits.sort(({ points: a }, { points: b }) => b - a)

    if ((specie as SpecieAttributeItem).reverseSituationPoint) {
      worldSituation.points = -worldSituation.points
    }
    const totalPoints = [
      specie,
      gender,
      worldSituation,
      initialStatus,
      residentStyle,
      ...Object.values(basicAbilities),
      ...traits,
    ].reduce((acc, it) => acc + it.points, 0)

    return {
      seed,
      totalPoints,
      specie,
      gender,
      worldSituation,
      initialStatus,
      residentStyle,
      basicAbilities,
      traits,
    }
  }
}
