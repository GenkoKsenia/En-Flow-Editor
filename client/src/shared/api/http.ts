import axios from 'axios'

export const http = axios.create({
  baseURL: 'https://localhost:7018/api',
  //baseURL: 'https://enplusflow.dev.enplus.digital/api',
  withCredentials: true,
})