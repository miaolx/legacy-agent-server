const testFun = () => {
  let a = 1
  let b = 1
  let c = a + b
  let list1 = [1,2,3,4,5]
  let list2 = []
  list1.forEach((item) => {
      list2.push(item)
  })
  console.log(a, b, c)
  console.log(list1, list2)
}