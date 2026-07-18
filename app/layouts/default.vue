<template>
  <CollctHeader />
  <div>
    <KeepAlive :max="10" :exclude="['post-id', 'user-username', 'login', 'settings', 'account']">
      <NuxtPage />
    </KeepAlive>
  </div>
</template>