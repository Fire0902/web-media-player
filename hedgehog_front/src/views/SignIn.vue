<script setup lang="ts">
import { useAuthStore } from '@/utils/authStore';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
    const authStore = useAuthStore();
    const router = useRouter();

    const email = ref("");
    const password = ref("");

    async function login(): Promise<any>{
        if(email.value && password.value){
            await authStore.login(email.value, password.value);
            router.push("/home");
        }
    }
    
</script>
<template>
    <section class="hero is-fullheight">
        <div class="hero-body has-text-centered">
            <div class="login mx-auto has-text-centered">
                <img class="logo" src="/hedgehog.svg" alt="hedgehog">
                
                <form @submit.prevent="login">
                    <div class="field">
                        <div class="control">
                            <input class="input is-medium is-rounded" v-model="email" type="email" placeholder="place@hold.er"
                                autocomplete="username" required />
                        </div>
                    </div>
                    <div class="field">
                        <div class="control">
                            <input class="input is-medium is-rounded" v-model="password" type="password" placeholder="**********"
                                autocomplete="current-password" required />
                        </div>
                    </div>
                    <br />
                    <button :class="['button is-block is-fullwidth is-primary is-medium is-rounded',
                        authStore.loading ? 'is-loading' : ''
                     ]" 
                     type="submit">
                        Login
                    </button>
                </form>
                <br>
                <nav class="level">
                    <div class="level-item has-text-centered">
                        <div>
                            <a href="#">Forgot Password?</a>
                        </div>
                    </div>
                    <div class="level-item has-text-centered">
                        <div>
                            <a href="#">Create an Account</a>
                        </div>
                    </div>
                </nav>
            </div>
        </div>
    </section>
</template>
<style scoped>
.logo{
    max-width: 30%;
    height: auto;
}
</style>