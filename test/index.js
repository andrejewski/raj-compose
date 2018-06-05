import test from 'ava'
import {
  mapEffect,
  batchEffects,
  mapProgram,
  batchPrograms,
  assembleProgram
} from '../src'

test('mapEffect() transforms any dispatched messages', t => {
  function rawEffect (dispatch) {
    dispatch(1)
    dispatch(2)
    dispatch(3)
  }

  const inc = n => n + 1
  const newEffect = mapEffect(rawEffect, inc)

  const results = []
  newEffect(result => results.push(result))

  t.deepEqual(results, [2, 3, 4], 'results should have been incremented')
})

test('mapEffect() should not wrap a falsey effect', t => {
  /*
    The reasoning for this test is that commands can
    be falsey and not run by the runtime.

    map() should align with this behavior.
  */

  t.notThrows(() => {
    const inc = n => n + 1
    const newEffect = mapEffect(null, inc)
    t.is(newEffect, null)
  })
})

test('mapEffect() should return the result of the effect', t => {
  const id = x => x
  const rawEffect = () => 1
  const newEffect = mapEffect(rawEffect, id)
  t.is(newEffect(), 1, 'newEffect should return the effect value')
})

test('mapEffect() should throw for a truthy non-function effect', t => {
  const id = x => x
  const badEffect = 10
  t.throws(() => mapEffect(badEffect, id), /must be functions/)
})

test('mapEffect() should throw for a non-function callback', t => {
  const badCallback = 10
  const effect = () => {}
  t.throws(() => mapEffect(effect, badCallback), /must be a function/)
})

test('batchEffects() should return a single effect', t => {
  t.is(typeof batchEffects([]), 'function')
})

test('batchEffects() should pass dispatch to each effect', t => {
  const makeEffect = dispatchVal => dispatch => dispatch(dispatchVal)
  const vals = [1, 2, 3]
  const effects = batchEffects(vals.map(makeEffect))

  const results = []
  effects(result => results.push(result))

  t.deepEqual(results, vals)
})

test('batchEffects() should not call falsey values', t => {
  /*
    The reasoning for this test is that commands can
    be falsey and not run by the runtime.

    batch() should align with this behavior.
  */

  t.notThrows(() => {
    const effects = batchEffects([null, false, undefined, 0])
    effects()
  })
})

test('batchEffects() should return the effects return values', t => {
  const makeEffect = returnVal => dispatch => returnVal
  const vals = [1, 2, 3]
  const effects = batchEffects(vals.map(makeEffect))
  t.deepEqual(effects(), vals)
})

test('batchEffects() should throw if any effect is a truthy non-function', t => {
  const badEffect = 10
  const goodEffect = () => {}
  t.throws(() => batchEffects([badEffect]), /must be functions/)
  t.throws(() => batchEffects([badEffect, goodEffect]), /must be functions/)
})

test('mapProgram() should return a done if the original program does', t => {
  const subProgramWithDone = {
    init: ['foo'],
    update () {},
    view () {},
    done (state) {
      t.is(state, 'foo')
      return () => {}
    }
  }

  const subProgramWithoutDone = {
    init: ['bar'],
    update () {},
    view () {}
  }

  const doneProgram = mapProgram(subProgramWithDone, x => x)
  const notDoneProgram = mapProgram(subProgramWithoutDone, x => x)

  t.is(typeof doneProgram.done, 'function')
  const [state] = doneProgram.init
  const effect = doneProgram.done(state)
  t.is(typeof effect, 'function')

  t.is(notDoneProgram.done, undefined)
})

test('batchPrograms() program.done should call sub program done functions', t => {
  const subProgramWithDone = {
    init: ['foo'],
    update () {},
    view () {},
    done (state) {
      t.is(state, 'foo')
    }
  }

  const subProgramWithoutDone = {
    init: ['bar'],
    update () {},
    view () {}
  }

  const program = batchPrograms([
    subProgramWithDone,
    subProgramWithoutDone
  ], () => {})

  const [state] = program.init
  program.done(state)
})

test('assembleProgram() should return an assembled program', t => {
  t.plan(5)

  const dataOptions = {}
  const logicOptions = {}
  const viewOptions = {}
  const dataResult = {}

  function data (options) {
    t.is(options, dataOptions)
    return dataResult
  }

  function logic (data, options) {
    t.is(data, dataResult)
    t.is(options, logicOptions)

    return {foo: 'bar'}
  }

  function view (model, dispatch, options) {
    t.is(options, viewOptions)
  }

  const program = assembleProgram({
    data,
    dataOptions,
    view,
    viewOptions,
    logic,
    logicOptions
  })

  t.is(program.foo, 'bar')
  program.view()
})
