import axios from 'axios'
import Cookies from 'js-cookie'

const http = axios.create({
  baseURL: '/',
  withCredentials: true,
})

const csrfToken = Cookies.get('csrftoken')

if (csrfToken) {
  http.defaults.headers.common['X-CSRFToken'] = csrfToken
}

export default http
