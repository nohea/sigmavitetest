
import glslify from 'rollup-plugin-glslify';

/**
 * @type {import('vite').UserConfig}
 */
const config = {
    plugins: [
        glslify({
            // Default
            include: [
                '**/*.vs',
                '**/*.fs',
                '**/*.vert',
                '**/*.frag',
                '**/*.glsl'
            ],

            // Undefined by default
            // exclude: 'node_modules/**',

            // Compress shader by default using logic from rollup-plugin-glsl
            // compress: true
        })]
}

export default config;
