const invariant = require('invariant')

function mapEffect (effect, callback) {
  invariant(typeof callback === 'function', 'callback must be a function')

  if (!effect) {
    return effect
  }

  invariant(typeof effect === 'function', 'Effects must be functions or falsy')

  return function _mapEffect (dispatch) {
    function intercept (message) {
      dispatch(callback(message))
    }

    return effect(intercept)
  }
}

function batchEffects (effects) {
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i]
    invariant(
      !effect || typeof effect === 'function',
      'Effects must be functions or falsy'
    )
  }

  return function _batchEffects (dispatch) {
    return effects.map(effect => {
      if (effect) {
        return effect(dispatch)
      }
    })
  }
}

function ensureProgram (program) {
  invariant(program, 'program must be truthy')
  invariant(Array.isArray(program.init), 'program.init must be an array')
  invariant(
    typeof program.update === 'function',
    'program.update must be a function'
  )
  invariant(
    typeof program.view === 'function',
    'program.view must be a function'
  )
  invariant(
    !program.done || typeof program.done === 'function',
    'program.done must be a function if included'
  )
}

function mapProgram (program, callback) {
  ensureProgram(program)
  invariant(typeof callback === 'function', 'callback must be a function')

  const start = program.init
  const init = [start[0], mapEffect(start[1], callback)]

  function update (msg, state) {
    const change = program.update(msg, state)
    return [change[0], mapEffect(change[1], callback)]
  }

  function view (state, dispatch) {
    return program.view(state, msg => dispatch(callback(msg)))
  }

  return { init, update, view, done: program.done }
}

function batchPrograms (programs, containerView) {
  invariant(Array.isArray(programs), 'programs must be an array')
  invariant(
    typeof containerView === 'function',
    'containerView must be a function'
  )

  const embeds = []
  const states = []
  const effects = []
  const programCount = programs.length
  for (let i = 0; i < programCount; i++) {
    const index = i
    const program = programs[index]
    ensureProgram(program)

    const embed = mapProgram(program, data => ({ index, data }))
    embeds.push(embed)
    states.push(embed.init[0])
    effects.push(embed.init[1])
  }

  const init = [states, batchEffects(effects)]

  function update (msg, state) {
    const { index, data } = msg
    const change = embeds[index].update(data, state[index])
    const newState = state.slice(0)
    newState[index] = change[0]
    return [newState, change[1]]
  }

  function view (state, dispatch) {
    const programViews = embeds.map((embed, index) => () =>
      embed.view(state[index], dispatch)
    )

    return containerView(programViews)
  }

  function done (state) {
    for (let i = 0; i < programCount; i++) {
      const done = embeds[i].done
      if (done) {
        done(state[i])
      }
    }
  }

  return { init, update, view, done }
}

function assembleProgram ({
  data,
  dataOptions,
  logic,
  logicOptions,
  view,
  viewOptions
}) {
  return Object.assign(
    {
      view (model, dispatch) {
        return view(model, dispatch, viewOptions)
      }
    },
    logic(data(dataOptions), logicOptions)
  )
}

exports.mapEffect = mapEffect
exports.batchEffects = batchEffects
exports.mapProgram = mapProgram
exports.batchPrograms = batchPrograms
exports.assembleProgram = assembleProgram
