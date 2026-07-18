<template>
  <CollctHeader />
  <div>
    <KeepAlive :max="10" :exclude="['post-id', 'login', 'settings', 'account']">
      <NuxtPage />
    </KeepAlive>
  </div>
</template>