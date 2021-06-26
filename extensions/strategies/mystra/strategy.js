var z = require('zero-fill')
  , n = require('numbro')
  , bollinger = require('../../../lib/bollinger')
  , Phenotypes = require('../../../lib/phenotype')
  , rsi = require('../../../lib/rsi')

const LONG = 'long'
const SHORT = 'short'
const PROFIT_FACTOR = 1.75


module.exports = {
  name: 'mystra',
  description: 'that\'s a secret',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '30m')
    this.option('period_length', 'period length, same as --period', String, '30m')
    
    this.option('bollinger_size', 'period size', Number, 20)
    this.option('bollinger_time', 'times of standard deviation between the upper band and the moving averages', Number, 2.5)

    this.option('rsi_periods', 'number of RSI periods', Number, 14)
  },

  calculate: function (s) {  
    bollinger(s, 'bollinger', s.options.bollinger_size)
    rsi(s, 'rsi', s.options.rsi_periods)

    // faster get out of a trade not waiting the end of the period
    // calculate gets called every 20 seconds
  
    if (s.direction){
      // in a trade 
      if (s.direction === LONG){
        if (s.period.close < s.nextStopLoss || s.period.close > s.nextTarget){
          // console.log('stopping short - stop '+ s.nextStopLoss+ ' target '+ s.nextTarget+ ' close '+ s.period.close)
          resetLastTrade(s)
          s.signal = 'sell'
        }      
      } else if (s.direction === SHORT){
        if (s.period.close > s.nextStopLoss || s.period.close < s.nextTarget){
          // console.log('stopping short - stop '+ s.nextStopLoss+ ' target '+ s.nextTarget+ ' close '+ s.period.close)
          resetLastTrade(s)
          s.signal = 'buy'
        }
      }
    }
  },

  onPeriod: function (s, cb) {
    // console.log( 'onPeriod' )
    
    if (s.period.bollinger && s.period.rsi && s.period.bollinger.upperBound) { // if one boud exists all of them do
      if (s.direction){ 
        s.signal = null
        return cb()
       }

      // let tradeDirection = rsiBullish(s.period.rsi) ? LONG : SHORT
      // console.log(tradeDirection)
      let tradeDirection
      if (s.period.rsi > 75){
        tradeDirection = LONG
      }
      if (s.period.rsi < 43){
        tradeDirection = SHORT
      }

      if (tradeDirection === LONG && s.period.high > s.period.bollinger.upperBound){
        // console.log('broken Up')
        s.direction = LONG
        s.nextStopLoss = s.period.bollinger.midBound
        s.nextTarget = s.period.close + ((s.period.close - s.nextStopLoss) * PROFIT_FACTOR)      
        s.signal = 'buy'
      } else if (tradeDirection === SHORT && s.period.low < s.period.bollinger.lowerBound) {
        // console.log('broken bown')
        s.direction = SHORT
        s.nextStopLoss = s.period.bollinger.midBound
        s.nextTarget = s.period.close - ((s.nextStopLoss - s.period.close) * PROFIT_FACTOR)      
        s.signal = 'sell'
      } else {
        s.signal = null
      }

    } else {
      s.signal = null
    }

    //console.log(JSON.stringify(s, null, 2))
    cb()
  },


  onReport : function (s) {
    var cols = []
    if (s.period.bollinger) {
      if (s.period.bollinger.upperBound && s.period.bollinger.lowerBound) {
        let upperBound = s.period.bollinger.upperBound
        let lowerBound = s.period.bollinger.lowerBound
        var color = 'grey'
        if (s.period.close > (upperBound / 100)) {
          color = 'green'
        } else if (s.period.close < (lowerBound / 100)) {
          color = 'red'
        }
        cols.push(z(8, n(s.period.close).format('+00.0000'), ' ')[color])
        cols.push(z(8, n(lowerBound).format('0.000000').substring(0,7), ' ').cyan)
        cols.push(z(8, n(upperBound).format('0.000000').substring(0,7), ' ').cyan)
      }
    }
    else {
      cols.push('         ')
    }
    return cols
  },

  phenotypes: {
    // -- common
    period_length: Phenotypes.RangePeriod(1, 120, 'm'),
    markdown_buy_pct: Phenotypes.RangeFloat(-1, 5),
    markup_sell_pct: Phenotypes.RangeFloat(-1, 5),
    order_type: Phenotypes.ListOption(['maker', 'taker']),
    sell_stop_pct: Phenotypes.Range0(1, 50),
    buy_stop_pct: Phenotypes.Range0(1, 50),
    profit_stop_enable_pct: Phenotypes.Range0(1, 20),
    profit_stop_pct: Phenotypes.Range(1,20),

    // -- strategy
    bollinger_size: Phenotypes.Range(1, 40),
    bollinger_time: Phenotypes.RangeFloat(1,6)   
  }

}

function resetLastTrade(s) {
  s.nextTarget = undefined
  s.nextTarget = undefined
  s.direction = undefined
}

function rsiBullish(rsi) {
  return rsi > 60
}