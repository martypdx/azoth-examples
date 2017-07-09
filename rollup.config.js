import resolve from 'rollup-plugin-node-resolve';
// import commonjs from 'rollup-plugin-commonjs';
import diamond from 'rollup-plugin-diamond';


export default {
    entry: 'src/index.js',
    format: 'es',
    plugins: [
        diamond(),
        resolve({ jsnext: true, module: true })
    ],
    // external: ['firebase']
    // sourceMap: true,
    dest: 'docs/bundle.js'
};