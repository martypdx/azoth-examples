import resolve from 'rollup-plugin-node-resolve';
import diamond from 'rollup-plugin-diamond';

export default {
    entry: 'src/index.js',
    format: 'es',
    plugins: [
        diamond(),
        resolve({ jsnext: true, module: true })
    ],
    // sourceMap: true,
    dest: 'build/bundle.js'
};