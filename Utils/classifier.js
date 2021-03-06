import '@tensorflow/tfjs-node'
import * as toxicmodel from '@tensorflow-models/toxicity'

export default class Classifier {
  constructor (threshold) {
    if (!threshold) throw new Error('No threshold found')
    this.setThreshold(threshold)
  }

  /**
     * @return {float}
     */
  getThreshold () {
    return this.threshold
  }

  /**
     * @param {float} newThreshold
     */
  setThreshold (newThreshold) {
    if (isNaN(newThreshold)) throw new Error(`Threshold parameted must be a number! Got ${newThreshold} (${typeof (newThreshold)})`)
    this.threshold = newThreshold / 10
  }

  /**
     * Classifies a message with Tensorflow Toxicity Model
     * @param {String} message
     * @returns {resultObject}
     */
  async classifyMessage (message) {
    let timeTaken = process.hrtime()
    const model = await toxicmodel.load(this.threshold)
    const res = await model.classify([message])
    timeTaken = process.hrtime(timeTaken)
    return this.parseClassifiedMessage(res, message, timeTaken)
  }

  /**
     * Takes set parameters and parses them into a result object to be used in other fucntions
     * @param {Model.Classify} results
     * @param {Discord.Message} message
     * @param {Process.hrtime} executionTime
     * @returns
     */
  parseClassifiedMessage (results, message, executionTime) {
    const resultObject = { message: message, executionTime: { seconds: executionTime[0], milliseconds: Math.round(executionTime[1] / 1e6) }, flagged: false, results: {} }
    results.forEach(element => {
      if (element.results[0].match) resultObject.flagged = true
      resultObject.results[element.label] = element.results[0].match || false
    })
    return resultObject
  }

  /**
     *
     * @returns {float} default value for threshold
     */
  static defaultThreshold () {
    return 0.9
  }
}
