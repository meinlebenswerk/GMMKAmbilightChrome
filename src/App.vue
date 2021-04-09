<template lang="pug">
#app
  RouterView
</template>

<style lang="scss">

// Import fonts
@import url('https://fonts.googleapis.com/css2?family=Inconsolata:wght@200;300;500;700;800&display=swap');

body {
  margin: 0;
}

* {
  box-sizing: border-box;
}

#app {

  font-family: 'Inconsolata', monospace;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;

  width: 100vw;
  height: 100vh;
}

#nav {
  padding: 30px;

  a {
    font-weight: bold;
    color: #2c3e50;

    &.router-link-exact-active {
      color: #42b983;
    }
  }
}
</style>
