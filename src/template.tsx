import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { pick } from 'cosmokit'
import { h, Session } from 'koishi'

import { Config } from './config'
import { name, version } from './const'
import { AttributeItem, CharacterAttributesSelection, DataSource } from './data'

export function formatDate(date?: Date) {
  if (!date) date = new Date()
  const yr = date.getFullYear()
  const mon = date.getMonth() + 1
  const day = date.getDate()
  const hr = date.getHours()
  const min = date.getMinutes().toString().padStart(2, '0')
  const sec = date.getSeconds().toString().padStart(2, '0')
  return `${yr}-${mon}-${day} ${hr}:${min}:${sec}`
}

export async function createTemplate(
  config: Config,
  source: DataSource,
  session: Session,
  data: CharacterAttributesSelection,
  scaleFactor: number,
): Promise<h.Fragment> {
  const attributeTemplate = async (item: AttributeItem) => (
    <div class="attr-card">
      <img class="card-img" src={await source.readAsDataUrl(item.imagePath)} />
      <div class="font-bold text-xl">{item.name}</div>
      <div
        class={`font-bold text-base text-${item.points > 0 ? 'green' : 'red'}`}
      >
        {item.points ? (
          `(${item.points > 0 ? '+' : ''}${item.points})`
        ) : (
          <span>&nbsp;</span>
        )}
      </div>
      <div class="text-sm text-center font-bold">{item.description}</div>
    </div>
  )

  const [manifest, world, basicAbilities, traits] = await Promise.all([
    source.readManifest(),
    Promise.all(
      Object.values(
        pick(data, [
          'specie',
          'gender',
          'worldSituation',
          'initialStatus',
          'residentStyle',
        ]) as any as Record<string, AttributeItem>,
      ).map(attributeTemplate),
    ),
    Promise.all(Object.values(data.basicAbilities).map(attributeTemplate)),
    Promise.all(data.traits.map(attributeTemplate)),
  ])
  const { username, userId } = session
  const body = (
    <main>
      <div class="flex flex-col items-center justify-center">
        <div class="font-bold text-5xl">重开设定</div>
        <div class="text-xl">
          难度评分 {data.totalPoints} | 种子 {data.seed}
        </div>
        <div class="text-xl">
          {`${username}${username === userId ? '' : ` (${userId})`}`}
        </div>
      </div>
      <div>
        <span class="font-bold text-4xl">世界设定</span>
        <span class="font-bold text-xl">（种族/性别/局势/开局/审美）</span>
      </div>
      <div class="attr-line">{world}</div>
      <div>
        <span class="font-bold text-4xl">基础能力</span>
        <span class="font-bold text-xl">（力量/魔力/智力/体质/魅力/运气）</span>
      </div>
      <div class="attr-line">{basicAbilities}</div>
      <div>
        <span class="font-bold text-4xl">特质</span>
      </div>
      <div class="attr-line">{traits}</div>
      <div class="text-center text-base text-gray">
        koishi-plugin-{name} v{version} | {formatDate()}
      </div>
    </main>
  )

  const fontFaces = manifest.fonts.map((it) => `'${it.family}'`).join(', ')
  const fontFaceStyle = manifest.fonts
    .map(
      (it) =>
        `@font-face { font-family: '${it.family}'; ` +
        `src: url(${pathToFileURL(path.join(source.dataPath, it.path)).href}); }`,
    )
    .join('\n')
  const style = `
  ${fontFaceStyle}
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .items-center { align-items: center; }
  .justify-center { justify-content: center; }
  .font-bold { font-weight: bold; }
  .text-5xl { font-size: ${48 / scaleFactor}px; }
  .text-4xl { font-size: ${36 / scaleFactor}px; }
  .text-xl { font-size: ${20 / scaleFactor}px; }
  .text-base { font-size: ${16 / scaleFactor}px; }
  .text-sm { font-size: ${14 / scaleFactor}px; }
  .text-center { text-align: center; }
  .text-red { color: rgb(220 38 38); }
  .text-green { color: rgb(22 163 74); }
  .text-gray { color: rgb(75 85 99); }

  main {
    background-color: #e6dcd2;
    padding: ${16 / scaleFactor}px;
    width: fit-content;
    display: flex;
    flex-direction: column;
    gap: ${16 / scaleFactor}px;
    font-family: ${fontFaces}, sans-serif;
  }
  .attr-line {
    display: grid;
    gap: ${16 / scaleFactor}px;
    align-items: flex-start;
    grid-template-columns: repeat(${config.attrNumPerLine}, minmax(0, 1fr));
  }
  .attr-card {
    width: ${104 / scaleFactor}px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${2 / scaleFactor}px;
  }
  .card-img {
    width: ${104 / scaleFactor}px;
  }`
  return (
    <html selector="main">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{style}</style>
      </head>
      {body}
    </html>
  )
}
