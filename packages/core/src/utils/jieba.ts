import { Jieba } from '@node-rs/jieba'
import { useLogger } from '@unbird/logg'

let _jieba: Jieba | undefined

export async function ensureJieba(): Promise<Jieba | undefined> {
  const logger = useLogger('jieba:loader')

  if (!_jieba) {
    try {
      // if (!isBrowser()) {
      //   const { loadDict } = await import('./jieba.dict')

      //   const dictBuffer = await loadDict()
      //   _jieba = Jieba.withDict(dictBuffer)
      // }
      // else {
      _jieba = new Jieba()
      // }

      logger.log('Jieba initialized successfully')
    }
    catch (error) {
      logger.withError(error).error('Failed to initialize jieba')

      // Return undefined on error, jieba is optional
      return undefined
    }
  }

  return _jieba
}
