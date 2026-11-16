import { describe, expect, it } from 'vitest'
import { readFirebaseConfig, toFirebaseOptions } from './firebaseConfig.ts'

describe('readFirebaseConfig', () => {
  it('falls back to local mode when the web config is incomplete', () => {
    expect(readFirebaseConfig({})).toBeNull()
    expect(readFirebaseConfig({ apiKey: 'key', authDomain: 'app.firebaseapp.com', projectId: 'proj' })).toBeNull()
  })

  it('returns a config when the required public fields are present', () => {
    const config = readFirebaseConfig({
      apiKey: ' key ',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo',
      appId: '1:2:web:abc',
    })
    expect(config).toMatchObject({
      apiKey: 'key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo',
      storageBucket: 'demo.appspot.com',
      appId: '1:2:web:abc',
    })
    expect(toFirebaseOptions(config!).messagingSenderId).toBeUndefined()
  })
})
