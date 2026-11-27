export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

export interface FirebaseEnv {
  apiKey?: string
  authDomain?: string
  projectId?: string
  storageBucket?: string
  messagingSenderId?: string
  appId?: string
}

export function readFirebaseConfig(env: FirebaseEnv = defaultEnv()): FirebaseWebConfig | null {
  const apiKey = clean(env.apiKey)
  const authDomain = clean(env.authDomain)
  const projectId = clean(env.projectId)
  const appId = clean(env.appId)
  if (!apiKey || !authDomain || !projectId || !appId) return null
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: clean(env.storageBucket) || `${projectId}.appspot.com`,
    messagingSenderId: clean(env.messagingSenderId),
    appId,
  }
}

function defaultEnv(): FirebaseEnv {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
}

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}
