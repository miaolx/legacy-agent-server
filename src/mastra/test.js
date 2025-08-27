

import addFun from './add.js'
import listFun  from './listFun.js'


const test = (x) => {
  let value = addFun(1, 2, x)
  let list = listFun([4, 5, x])
  list.push(value)
}

export default test