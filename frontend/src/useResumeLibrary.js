import { useCallback, useEffect, useState } from 'react'
import { listResumes } from './api'

export default function useResumeLibrary() {
  const [library, setLibrary] = useState([])

  const refresh = useCallback(() => {
    listResumes().then(setLibrary).catch(() => {})
  }, [])

  useEffect(refresh, [refresh])

  return [library, refresh]
}
