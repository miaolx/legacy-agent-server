

import addFun from './add.js'
import listFun  from './listFun.js'


const test = () => {
  let value = addFun(1, 2, 3)
  let list = listFun([4, 5, 6])
  return list.push(value)
}

export default test